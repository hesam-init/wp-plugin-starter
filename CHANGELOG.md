# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

- Initial release.
- Translations: English source strings and a Persian (fa_IR) translation, with RTL support.
- REST requests use `@wordpress/api-fetch` (WordPress' `wp.apiFetch`).
- Status submenu page (`GET /status`) showing plugin, WordPress, PHP/server and database information, with a copyable plain-text report.
- Tooling: Biome replaces ESLint and Prettier for linting and formatting the admin app (`admin-client/biome.json`).
