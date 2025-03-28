-- CREATE TABLE sessions (
--   id SERIAL PRIMARY KEY,
--   username TEXT UNIQUE NOT NULL,
--   password TEXT NOT NULL,
--   code TEXT UNIQUE NOT NULL,
--   expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  mac_address TEXT NOT NULL,
  sign_in_code TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);