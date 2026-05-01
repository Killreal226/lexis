package storage

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/google/uuid"
)

var ErrUnsupportedImageType = errors.New("unsupported image type")

var allowedImageMIMEs = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

type ImageStore struct {
	baseDir   string
	urlPrefix string
}

func NewImageStore(baseDir, urlPrefix string) (*ImageStore, error) {
	if err := os.MkdirAll(baseDir, 0o755); err != nil {
		return nil, fmt.Errorf("create image storage dir %q: %w", baseDir, err)
	}
	return &ImageStore{
		baseDir:   baseDir,
		urlPrefix: urlPrefix,
	}, nil
}

func (s *ImageStore) Save(r io.Reader) (string, error) {
	head := make([]byte, 512)
	n, err := io.ReadFull(r, head)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) && !errors.Is(err, io.EOF) {
		return "", fmt.Errorf("read image head: %w", err)
	}
	head = head[:n]

	mime := http.DetectContentType(head)
	ext, ok := allowedImageMIMEs[mime]
	if !ok {
		return "", fmt.Errorf("%w: %s", ErrUnsupportedImageType, mime)
	}

	filename := uuid.NewString() + ext
	diskPath := filepath.Join(s.baseDir, filename)

	f, err := os.OpenFile(diskPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return "", fmt.Errorf("create image file: %w", err)
	}

	if _, err := f.Write(head); err != nil {
		f.Close()
		_ = os.Remove(diskPath)
		return "", fmt.Errorf("write image head: %w", err)
	}
	if _, err := io.Copy(f, r); err != nil {
		f.Close()
		_ = os.Remove(diskPath)
		return "", fmt.Errorf("write image body: %w", err)
	}
	if err := f.Close(); err != nil {
		_ = os.Remove(diskPath)
		return "", fmt.Errorf("close image file: %w", err)
	}

	return s.urlPrefix + "/" + filename, nil
}

func (s *ImageStore) Delete(publicPath string) error {
	filename := filepath.Base(publicPath)
	if filename == "." || filename == "/" || filename == "" {
		return fmt.Errorf("invalid image path: %q", publicPath)
	}
	if err := os.Remove(filepath.Join(s.baseDir, filename)); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("delete image %q: %w", filename, err)
	}
	return nil
}
