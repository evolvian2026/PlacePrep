-- The catalogue grew past 150 employers, and their free-text `industry` labels
-- are too specific to filter by (117 distinct values across 171 companies).
-- `sector` is the coarse bucket the directory's facet uses; `industry` stays as
-- the precise label shown on the company card.
ALTER TABLE companies ADD COLUMN sector TEXT;

CREATE INDEX IF NOT EXISTS idx_companies_sector ON companies(sector);
