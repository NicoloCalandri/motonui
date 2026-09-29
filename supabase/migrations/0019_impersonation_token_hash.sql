-- =============================================================================
-- motonui — Impersonation tokens stored as hashes
-- Migration: 0019_impersonation_token_hash.sql
--
-- T-1.8 (SR-CRYPTO-03, SR-CRYPTO-04; ADR-07). From this release the API stores
-- SHA-256(jti) in impersonation_tokens.token instead of the signed JWT, and
-- the middleware refuses tokens whose hash is no longer present (revocation).
-- Rows written by the previous version contain usable plaintext JWTs: they
-- expire within 30 minutes anyway, so they are simply removed (any session
-- still running ends and the admin starts a new one).
-- =============================================================================

delete from public.impersonation_tokens;

comment on column public.impersonation_tokens.token is
  'Hex SHA-256 of the impersonation JWT jti. The token itself is never stored; deleting the row revokes it.';
