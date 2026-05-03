package main

import (
	"context"
	"database/sql"
	"encoding/csv"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"time"

	"github.com/Killreal226/lexis/backend/internal/config"
	"github.com/Killreal226/lexis/backend/internal/database"
)

const (
	defaultCSVPath = "data/words.csv"
	csvDelimiter   = '|'
	importTimeout  = 30 * time.Second
)

var csvHeader = []string{
	"id", "word", "translation", "example_en", "example_ru", "image_path",
}

type wordRow struct {
	Word        string
	Translation string
	ExampleEn   string
	ImagePath   *string
	ExampleRu   *string
}

func main() {
	csvPath := flag.String("file", defaultCSVPath, "path to the words CSV file")
	force := flag.Bool("force", false, "insert even if shared words already exist")
	flag.Parse()

	if err := run(*csvPath, *force); err != nil {
		log.Fatalf("import: %v", err)
	}
}

func run(csvPath string, force bool) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	db, err := database.NewDB(cfg.DSN())
	if err != nil {
		return fmt.Errorf("connect db: %w", err)
	}
	defer db.Close()

	rows, err := readCSV(csvPath)
	if err != nil {
		return fmt.Errorf("read csv %q: %w", csvPath, err)
	}
	if len(rows) == 0 {
		log.Printf("import: %q is empty, nothing to do", csvPath)
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), importTimeout)
	defer cancel()

	inserted, skipped, err := importWords(ctx, db, rows, force)
	if err != nil {
		return err
	}
	if skipped {
		log.Printf("import: shared words already present, skipping (use -force to override)")
		return nil
	}
	log.Printf("import: inserted %d shared word(s) from %s", inserted, csvPath)
	return nil
}

func readCSV(path string) ([]wordRow, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.Comma = csvDelimiter
	r.FieldsPerRecord = len(csvHeader)
	r.TrimLeadingSpace = true

	header, err := r.Read()
	if err != nil {
		return nil, fmt.Errorf("read header: %w", err)
	}
	if err := validateHeader(header); err != nil {
		return nil, err
	}

	var rows []wordRow
	for line := 2; ; line++ {
		rec, err := r.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("line %d: %w", line, err)
		}
		row, err := toWordRow(rec)
		if err != nil {
			return nil, fmt.Errorf("line %d: %w", line, err)
		}
		rows = append(rows, row)
	}
	return rows, nil
}

func validateHeader(header []string) error {
	if len(header) != len(csvHeader) {
		return fmt.Errorf("header has %d columns, want %d", len(header), len(csvHeader))
	}
	for i, want := range csvHeader {
		if !strings.EqualFold(strings.TrimSpace(header[i]), want) {
			return fmt.Errorf("header[%d]: got %q, want %q", i, header[i], want)
		}
	}
	return nil
}

func toWordRow(rec []string) (wordRow, error) {
	word := strings.ToLower(strings.TrimSpace(rec[1]))
	translation := strings.TrimSpace(rec[2])
	exampleEn := strings.TrimSpace(rec[3])
	if word == "" || translation == "" || exampleEn == "" {
		return wordRow{}, errors.New("word, translation and example_en are required")
	}
	return wordRow{
		Word:        word,
		Translation: translation,
		ExampleEn:   exampleEn,
		ExampleRu:   nullable(rec[4]),
		ImagePath:   nullable(rec[5]),
	}, nil
}

func nullable(v string) *string {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}
	return &v
}

func importWords(
	ctx context.Context, db *sql.DB, rows []wordRow, force bool,
) (inserted int, skipped bool, err error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return 0, false, fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if !force {
		var existing int
		if err = tx.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM words WHERE created_by IS NULL`,
		).Scan(&existing); err != nil {
			return 0, false, fmt.Errorf("count shared words: %w", err)
		}
		if existing > 0 {
			return 0, true, tx.Commit()
		}
	}

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO words (word, translation, example_en, example_ru, image_path, created_by)
		VALUES ($1, $2, $3, $4, $5, NULL)
	`)
	if err != nil {
		return 0, false, fmt.Errorf("prepare insert: %w", err)
	}
	defer stmt.Close()

	for i, row := range rows {
		if _, err = stmt.ExecContext(ctx,
			row.Word, row.Translation, row.ExampleEn, row.ExampleRu, row.ImagePath,
		); err != nil {
			return 0, false, fmt.Errorf("insert row %d (%q): %w", i+1, row.Word, err)
		}
	}

	if err = tx.Commit(); err != nil {
		return 0, false, fmt.Errorf("commit: %w", err)
	}
	return len(rows), false, nil
}
