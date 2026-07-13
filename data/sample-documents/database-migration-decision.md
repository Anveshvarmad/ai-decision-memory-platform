# Database Architecture Meeting

Date: March 18, 2026

Participants:
- Alice Chen, Engineering Manager
- Bob Martinez, Backend Engineer
- Priya Shah, Site Reliability Engineer

## Problem

The order-management service currently stores transactional data in
MongoDB. Reporting queries require multiple application-side joins, and
the p95 latency for monthly reports has increased to 4.8 seconds.

A production incident on March 4 caused reporting requests to consume
most of the MongoDB connection pool. This delayed customer order
updates for approximately eleven minutes.

## Alternatives Considered

### Continue using MongoDB

The team considered adding compound indexes and creating a separate
reporting collection. This would require duplicated data and additional
synchronization logic.

### MySQL

MySQL would support relational queries, but the team had less internal
operational experience with its replication and JSON capabilities.

### PostgreSQL

PostgreSQL supports relational transactions, joins, JSONB, mature
indexing, and the reporting queries required by the analytics team.

## Decision

The team approved migrating the order-management service from MongoDB
to PostgreSQL.

The primary reasons were transactional consistency, support for complex
joins, existing team experience, and the need to prevent reporting
queries from affecting customer order updates.

Alice approved the architecture change. Bob will create the migration
service and Priya will prepare database monitoring and rollback
procedures.

## Implementation Plan

The migration will use dual writes for two weeks. Historical data will
be copied using a background migration job. The team will compare record
counts and checksums before switching reads to PostgreSQL.

Target production rollout: April 15, 2026.
