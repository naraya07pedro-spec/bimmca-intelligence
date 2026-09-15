# Security Policy

BIMMCA Intelligence is intentionally public-safe. The repository is meant to expose a reviewable dashboard/application layer without publishing privileged Supabase credentials, private n8n secrets, confidential client material, or administrative backend access.

## Reporting a security issue

Please **do not open a public GitHub issue** for suspected credential exposure, authorization problems, or other security-sensitive findings.

Report privately to:

**evan@varevant.com**

Please include, where relevant:

- the affected file, page, or configuration;
- steps to reproduce;
- the observed impact;
- screenshots or request/response details with secrets redacted.

## Useful report categories

Useful reports may include:

- exposed privileged credentials or tokens;
- unintended access to private data;
- authorization failures;
- unsafe public configuration;
- secret leakage through static assets or deployment output.

Please avoid destructive testing, denial-of-service activity, social engineering, or accessing data beyond what is necessary to demonstrate the issue.

## Public-key boundary

A browser-side publishable key is not equivalent to a service-role or administrative credential. Correct authorization must still be enforced at the data layer, and privileged keys must never be committed to this repository.

This repository does not publish a bug-bounty program or promise a specific response SLA.
