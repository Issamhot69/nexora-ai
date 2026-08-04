ALTER TABLE organizations ADD COLUMN tax_country VARCHAR(2) DEFAULT 'FR';

CREATE TABLE tax_rates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code    VARCHAR(2) NOT NULL,
    label           VARCHAR(100) NOT NULL,
    rate            NUMERIC(5,2) NOT NULL,
    is_default      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tax_rates_country ON tax_rates(country_code);

INSERT INTO tax_rates (country_code, label, rate, is_default) VALUES
    ('FR', 'TVA standard', 20.00, TRUE),
    ('MA', 'TVA standard', 20.00, TRUE),
    ('BE', 'TVA standard', 21.00, TRUE),
    ('DE', 'TVA standard', 19.00, TRUE),
    ('ES', 'TVA standard', 21.00, TRUE),
    ('IT', 'TVA standard', 22.00, TRUE),
    ('GB', 'VAT standard', 20.00, TRUE),
    ('US', 'Sales tax (moyenne, varie par etat)', 0.00, TRUE),
    ('AE', 'VAT standard', 5.00, TRUE),
    ('CA', 'GST (federal, hors taxes provinciales)', 5.00, TRUE);
