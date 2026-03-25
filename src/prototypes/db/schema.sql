CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    username        TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    firebase_id     TEXT,
    email           TEXT NOT NULL UNIQUE,
    role            TEXT NOT NULL DEFAULT 'applicant',
    resume_id       BIGINT,
    cover_letter_id BIGINT
);

CREATE TABLE resume (
    id                 BIGSERIAL PRIMARY KEY,
    owner_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title              TEXT NOT NULL,
    created_date       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_updated_date  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users
    ADD CONSTRAINT fk_users_resume
    FOREIGN KEY (resume_id) REFERENCES resume(id);

CREATE TABLE resume_version (
    id           BIGSERIAL PRIMARY KEY,
    resume_id    BIGINT NOT NULL REFERENCES resume(id) ON DELETE CASCADE,
    version_no   INTEGER NOT NULL,
    title        TEXT NOT NULL,
    created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_resume_version_unique
    ON resume_version (resume_id, version_no);

CREATE TABLE resume_experience (
    id               BIGSERIAL PRIMARY KEY,
    resume_version   BIGINT NOT NULL REFERENCES resume_version(id) ON DELETE CASCADE,
    company          TEXT,
    title            TEXT,
    location         TEXT,
    start_date       DATE,
    end_date         DATE,
    is_current       BOOLEAN DEFAULT FALSE,
    bullet_point     TEXT
);

CREATE INDEX idx_experience_resume_version
    ON resume_experience (resume_version);

CREATE TABLE resume_education (
    id               BIGSERIAL PRIMARY KEY,
    resume_version   BIGINT NOT NULL REFERENCES resume_version(id) ON DELETE CASCADE,
    school           TEXT,
    degree           TEXT,
    study_field      TEXT,
    start_date       DATE,
    end_date         DATE,
    gpa              NUMERIC(3,2)
);

CREATE INDEX idx_education_resume_version
    ON resume_education (resume_version);

CREATE TABLE resume_skills (
    id               BIGSERIAL PRIMARY KEY,
    resume_version   BIGINT NOT NULL REFERENCES resume_version(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    level            TEXT
);

CREATE INDEX idx_skills_resume_version
    ON resume_skills (resume_version);

CREATE TABLE resume_projects (
    id               BIGSERIAL PRIMARY KEY,
    resume_version   BIGINT NOT NULL REFERENCES resume_version(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    description      TEXT,
    tech_stack       TEXT[],
    links            TEXT[]
);

CREATE INDEX idx_projects_resume_version
    ON resume_projects (resume_version);

CREATE TABLE resume_certifications (
    id               BIGSERIAL PRIMARY KEY,
    resume_version   BIGINT NOT NULL REFERENCES resume_version(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    issuer           TEXT,
    issue_date       DATE,
    expiry_date      DATE
);

CREATE INDEX idx_certifications_resume_version
    ON resume_certifications (resume_version);

CREATE TABLE job_posting (
    id          BIGSERIAL PRIMARY KEY,
    owner_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url         TEXT,
    title       TEXT,
    company     TEXT,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cover_letter (
    id             BIGSERIAL PRIMARY KEY,
    owner_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_posting_id BIGINT REFERENCES job_posting(id) ON DELETE SET NULL,
    created_date   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_date   TIMESTAMPTZ NOT NULL DEFAULT now(),
    text           TEXT NOT NULL
);

ALTER TABLE users
    ADD CONSTRAINT fk_users_cover_letter
    FOREIGN KEY (cover_letter_id) REFERENCES cover_letter(id);

CREATE TABLE interview_questions (
    id         BIGSERIAL PRIMARY KEY,
    topic      TEXT,
    difficulty TEXT,
    prompt     TEXT NOT NULL
);

CREATE TABLE interview_answers (
    id           BIGSERIAL PRIMARY KEY,
    questions_id BIGINT NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
    answer       TEXT,
    score        INTEGER,
    feedback     TEXT,
    created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);