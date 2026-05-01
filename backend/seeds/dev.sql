TRUNCATE TABLE progress, words, users RESTART IDENTITY CASCADE;

-- passwords: admin = "test1234", user = "test"
INSERT INTO users (email, password_hash, is_superuser) VALUES
    ('admin@lexis.local', '$2a$10$AAaddP8CmZWGqvm3qhIDAOSN2dMfess3qoz0oe8QLfbundJzEG9Vm', TRUE),
    ('user@lexis.local',  '$2a$10$1xNHdaj.WloO6MPkjrbrtuW7eP7JZQ5hc249pQX7cW6kqVd2iwR36', FALSE);

-- shared words (created_by = NULL) — id 1..10
INSERT INTO words (word, translation, example_en, example_ru, image_path, created_by) VALUES
    ('dog',     'собака',  'The dog is barking loudly.',      'Собака громко лает.',        'images/dog.jpg',     NULL),
    ('cat',     'кошка',   'The cat is sleeping on the sofa.','Кошка спит на диване.',      'images/cat.jpg',     NULL),
    ('cow',     'корова',  'The cow gives fresh milk.',       'Корова даёт свежее молоко.', 'images/cow.jpg',     NULL),
    ('horse',   'лошадь',  'I rode a horse yesterday.',       'Я катался на лошади вчера.', 'images/horse.jpg',   NULL),
    ('pig',     'свинья',  'The pig is eating an apple.',     'Свинья ест яблоко.',         'images/pig.jpg',     NULL),
    ('sheep',   'овца',    'A sheep has thick wool.',         'У овцы густая шерсть.',      'images/sheep.jpg',   NULL),
    ('chicken', 'курица',  'The chicken laid an egg.',        'Курица снесла яйцо.',        'images/chicken.jpg', NULL),
    ('duck',    'утка',    'A duck is swimming in the pond.', 'Утка плавает в пруду.',      'images/duck.jpg',    NULL),
    ('rabbit',  'кролик',  'The rabbit loves carrots.',       'Кролик любит морковь.',      'images/rabbit.jpg',  NULL),
    ('lion',    'лев',     'The lion is the king of animals.','Лев — царь зверей.',         'images/lion.jpg',    NULL);

-- private word of user 2 (id 11)
INSERT INTO words (word, translation, example_en, example_ru, image_path, created_by) VALUES
    ('wolf', 'волк', 'A wolf howls at the moon.', 'Волк воет на луну.', 'images/wolf.jpg', 2);


-- progress для user 2 (user@lexis.local) — покрываем все фазы и кейсы
INSERT INTO progress (user_id, word_id, direction, level, last_reviewed_at) VALUES
    -- === learning phase (level < 10) ===
    (2, 1,  'en_ru', 0,  NULL),                          -- dog en→ru: создано, но ни разу не отвечали
    (2, 1,  'ru_en', 3,  NOW() - INTERVAL '1 day'),      -- dog ru→en: в начале learning
    (2, 2,  'en_ru', 5,  NOW() - INTERVAL '6 hours'),    -- cat en→ru: середина learning
    (2, 2,  'ru_en', 9,  NOW() - INTERVAL '2 days'),     -- cat ru→en: почти review

    -- === review phase (level >= 10) ===
    (2, 3,  'en_ru', 10, NOW() - INTERVAL '1 hour'),     -- cow en→ru: только вошёл в review
    (2, 3,  'ru_en', 12, NOW() - INTERVAL '5 days'),     -- cow ru→en: review, давно не трогали
    (2, 4,  'en_ru', 15, NOW() - INTERVAL '12 hours'),   -- horse en→ru: середина review
    (2, 4,  'ru_en', 18, NOW() - INTERVAL '3 days'),     -- horse ru→en: почти mastered
    (2, 5,  'en_ru', 20, NOW() - INTERVAL '30 days'),    -- pig en→ru: mastered, но старое
    (2, 5,  'ru_en', 20, NOW() - INTERVAL '10 minutes'), -- pig ru→en: mastered, свежее

    -- === только одно направление (для теста "нужно добавить второе") ===
    (2, 6,  'en_ru', 7,  NOW() - INTERVAL '1 day'),      -- sheep только en→ru, ru→en отсутствует

    -- === прогресс по приватному слову ===
    (2, 11, 'en_ru', 4,  NOW() - INTERVAL '2 days'),     -- wolf en→ru (private word)
    (2, 11, 'ru_en', 0,  NULL);                          -- wolf ru→en: создано, не трогали

-- слова БЕЗ прогресса для user 2: chicken, duck, rabbit, lion
-- → эти должны ловиться в onboarding / "учить новые"


-- progress для user 1 (admin) — проверка изоляции пользователей
INSERT INTO progress (user_id, word_id, direction, level, last_reviewed_at) VALUES
    (1, 1, 'en_ru', 15, NOW() - INTERVAL '1 day'),       -- у админа dog уже в review
    (1, 2, 'en_ru', 10, NOW() - INTERVAL '2 days');      -- у админа cat только зашёл в review
