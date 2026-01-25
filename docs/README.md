# EnviroFlow Documentation

Welcome to the comprehensive documentation for EnviroFlow - the universal environmental automation platform.

## Documentation Structure

This documentation is organized into several key sections to help you get the most out of EnviroFlow.

### Quick Links

| Document | Description | Audience |
|----------|-------------|----------|
| [CHANGELOG.md](CHANGELOG.md) | Version history and release notes | All users |
| [User Guide](user-guide/) | End-user documentation | Growers, operators |
| [API Documentation](api/) | REST API reference | Developers, integrators |
| [Admin Guide](admin-guide.md) | Deployment and operations | System administrators |
| [Controller Guides](controller-guides/) | Brand-specific setup instructions | All users |
| [Migration Guide](MIGRATION_GUIDE.md) | Upgrade instructions | Administrators |

## Getting Started

### New Users

If you're new to EnviroFlow:

1. **Read:** [User Guide - Getting Started](user-guide/README.md#getting-started)
2. **Setup:** Choose your controller from [Controller Guides](controller-guides/)
3. **Learn:** Follow the interactive onboarding tour in the app
4. **Explore:** Try creating your first workflow

### Developers

If you're integrating with EnviroFlow:

1. **Read:** [API Documentation](api/)
2. **Review:** [CLAUDE.md](../CLAUDE.md) for architecture overview
3. **Explore:** Example code in [API Examples](api/README.md#examples)
4. **Contribute:** See [Contributing Guide](#contributing)

### Administrators

If you're deploying EnviroFlow:

1. **Read:** [Admin Guide](admin-guide.md)
2. **Setup:** Follow [Installation](admin-guide.md#installation) instructions
3. **Secure:** Review [Security](admin-guide.md#security) section
4. **Monitor:** Set up [Monitoring](admin-guide.md#monitoring--logging)

## Documentation Sections

### 1. Changelog

**File:** [CHANGELOG.md](CHANGELOG.md)

Complete version history including:
- New features and enhancements
- Bug fixes
- Breaking changes
- Security updates
- Migration notes

**Latest Version:** 2.0.0 (2026-01-24)

### 2. User Guide

**Directory:** [user-guide/](user-guide/)

Comprehensive end-user documentation covering:

- **Getting Started** - Account setup, onboarding tour
- **Adding Controllers** - Step-by-step setup for all brands
- **Dashboard & Monitoring** - Real-time sensor data, VPD, charts
- **Creating Workflows** - Visual workflow builder, automation logic
- **Scheduling & Automation** - Device schedules, sunrise/sunset
- **Analytics & Reports** - Data analysis, export, insights
- **Troubleshooting** - Common issues and solutions
- **Advanced Features** - AI recommendations, bulk operations

**Start Here:** [User Guide README](user-guide/README.md)

### 3. API Documentation

**Directory:** [api/](api/)

REST API reference for developers:

- **Authentication** - JWT tokens, login, refresh
- **Controllers API** - CRUD operations, discovery, testing
- **Sensors API** - Read sensor data, latest readings
- **Rooms API** - Room management
- **Workflows API** - Automation management
- **Analytics API** - Data analysis, heatmaps, correlations
- **Webhooks** - Incoming webhooks (Ecowitt, custom)
- **Error Handling** - Error categories, codes, responses
- **Rate Limiting** - API limits and best practices

**Start Here:** [API README](api/README.md)

### 4. Admin Guide

**File:** [admin-guide.md](admin-guide.md)

Operations and deployment guide:

- **System Requirements** - Hardware, software specs
- **Installation** - Vercel, self-hosted, Docker
- **Configuration** - Environment variables, settings
- **Database Management** - Migrations, backups, optimization
- **Performance Tuning** - Database, application, caching
- **Monitoring & Logging** - Health checks, error tracking
- **Security** - Encryption, RLS, API security, audit logs
- **Backup & Recovery** - Backup strategies, restore procedures
- **Troubleshooting** - Common issues, debug mode
- **Scaling** - Horizontal and vertical scaling

**Start Here:** [Admin Guide](admin-guide.md)

### 5. Controller Guides

**Directory:** [controller-guides/](controller-guides/)

Brand-specific setup instructions:

| Brand | Status | Guide |
|-------|--------|-------|
| **AC Infinity** | Full Support | [ac_infinity.md](controller-guides/ac_infinity.md) |
| **Govee** | Full Support | [govee.md](controller-guides/govee.md) |
| **Ecowitt** | Full Support | [ecowitt.md](controller-guides/ecowitt.md) |
| **MQTT** | Full Support | [mqtt.md](controller-guides/mqtt.md) |
| **Inkbird** | CSV Upload | [inkbird.md](controller-guides/inkbird.md) |
| **CSV Upload** | Full Support | [csv_upload.md](controller-guides/csv_upload.md) |

Each guide includes:
- Prerequisites and supported models
- Step-by-step setup instructions
- Troubleshooting common errors
- Tips for success
- Security considerations

### 6. Migration Guide

**File:** [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)

Upgrade instructions for version changes:

- **Pre-migration checklist** - Backups, documentation
- **Migration steps** - Code, database, configuration
- **Database migrations** - SQL scripts, verification
- **Configuration changes** - Environment variables
- **Breaking changes** - What changed and how to adapt
- **Post-migration verification** - Health checks, testing
- **Rollback procedure** - How to revert if needed
- **Troubleshooting** - Common migration issues

**Current:** Migrating to 2.0.0

### 7. Additional Resources

**Project Planning:**
- [README_PROJECT_PLANNING.md](../README_PROJECT_PLANNING.md) - Development roadmap
- [spec/](spec/) - Detailed specifications and PRDs

**Setup Guides:**
- [SETUP.md](SETUP.md) - Initial project setup
- [DATABASE_SETUP.md](DATABASE_SETUP.md) - Database configuration
- [BACKEND_GUIDE.md](BACKEND_GUIDE.md) - Backend architecture

**Integration Guides:**
- [AI_INTEGRATION.md](AI_INTEGRATION.md) - Grok AI integration
- [ecowitt-webhook-setup.md](ecowitt-webhook-setup.md) - Ecowitt webhook setup

## Documentation Standards

### Markdown Style

All documentation uses GitHub-flavored Markdown with:
- Clear hierarchical headings (H1, H2, H3)
- Code blocks with language tags
- Tables for structured data
- Bullet points for lists
- Numbered lists for sequential steps

### Code Examples

Code examples include:
- Language-specific syntax highlighting
- Comments explaining key lines
- Complete, runnable examples
- Error handling
- Best practices

### Screenshots

Screenshots and diagrams:
- Stored in `docs/images/` directory
- Referenced with relative paths
- Alt text for accessibility
- Annotated for clarity

## Contributing to Documentation

We welcome documentation improvements!

### How to Contribute

1. **Fork the Repository**
   ```bash
   git clone https://github.com/yourusername/enviroflow.git
   ```

2. **Create Branch**
   ```bash
   git checkout -b docs/improve-user-guide
   ```

3. **Make Changes**
   - Edit Markdown files
   - Add screenshots if helpful
   - Follow existing style

4. **Test Locally**
   - Preview Markdown rendering
   - Check all links work
   - Verify code examples

5. **Submit Pull Request**
   - Describe changes
   - Reference related issues
   - Tag as "documentation"

### Documentation Guidelines

**Writing Style:**
- Clear, concise, active voice
- Step-by-step instructions
- Examples for complex concepts
- Avoid jargon or explain technical terms

**Structure:**
- One topic per file
- Logical flow (simple → complex)
- Quick reference at top
- Detailed explanation below

**Code Examples:**
- Runnable, tested code
- Comments for clarity
- Error handling included
- Language-agnostic where possible

**Screenshots:**
- High resolution (1920x1080 preferred)
- Annotated with arrows/highlights
- Up-to-date with current UI
- Alt text for accessibility

## Documentation Versioning

Documentation is versioned alongside code:

- **main branch** - Latest stable documentation (2.0.0)
- **develop branch** - In-progress documentation
- **Version tags** - Documentation snapshots (v2.0.0, v1.0.0)

View documentation for specific versions:
```bash
git checkout v1.0.0
cd docs/
```

## Frequently Asked Questions

### Where do I start?

**As a User:** [User Guide - Getting Started](user-guide/README.md#getting-started)

**As a Developer:** [API Documentation](api/)

**As an Administrator:** [Admin Guide](admin-guide.md)

### How do I add a new controller?

See the appropriate controller guide:
- [AC Infinity](controller-guides/ac_infinity.md)
- [Govee](controller-guides/govee.md)
- [Ecowitt](controller-guides/ecowitt.md)
- [MQTT](controller-guides/mqtt.md)
- [CSV Upload](controller-guides/csv_upload.md)

### How do I create a workflow?

See [User Guide - Creating Workflows](user-guide/README.md#creating-workflows)

### How do I export my data?

See [User Guide - Analytics & Reports](user-guide/README.md#analytics--reports)

### How do I upgrade to 2.0?

See [Migration Guide](MIGRATION_GUIDE.md)

### Where are the API docs?

See [API Documentation](api/)

### How do I troubleshoot errors?

See:
- [User Guide - Troubleshooting](user-guide/README.md#troubleshooting)
- [Admin Guide - Troubleshooting](admin-guide.md#troubleshooting)
- Controller-specific guides for connection errors

### How do I get support?

**Email:** support@enviroflow.app

**Community Forum:** [community.enviroflow.app](https://community.enviroflow.app)

**GitHub Issues:** [github.com/yourusername/enviroflow/issues](https://github.com/yourusername/enviroflow/issues)

### Can I use EnviroFlow offline?

EnviroFlow requires internet for cloud features (controller APIs, AI). Local features work offline. See [Admin Guide - Scaling](admin-guide.md#scaling) for local-first setup.

### Is my data secure?

Yes. See [Admin Guide - Security](admin-guide.md#security) for details on encryption, RLS, and audit logging.

## Documentation Roadmap

Planned documentation improvements:

**Q1 2026:**
- [ ] Video tutorials for common tasks
- [ ] Interactive API playground
- [ ] More workflow examples
- [ ] Localization (Spanish, French)

**Q2 2026:**
- [ ] Mobile app documentation
- [ ] Advanced automation cookbook
- [ ] Performance optimization guide
- [ ] Multi-tenant setup guide

## Support

### Documentation Issues

Found an error or have a suggestion?

**Report Issues:**
- [GitHub Issues](https://github.com/yourusername/enviroflow/issues) with "documentation" label
- Email: docs@enviroflow.app

**Request Documentation:**
- Missing a guide?
- Need more examples?
- Want a specific topic covered?

Submit a documentation request via GitHub Issues.

### Community

**Forum:** [community.enviroflow.app](https://community.enviroflow.app)

**Discord:** [discord.gg/enviroflow](https://discord.gg/enviroflow)

**Twitter:** [@EnviroFlowApp](https://twitter.com/EnviroFlowApp)

## License

Documentation is licensed under [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

Code examples in documentation are licensed under the same license as the EnviroFlow project (see [LICENSE](../LICENSE)).

## Acknowledgments

Documentation contributors:
- EnviroFlow Team
- Community contributors
- Technical writers
- Beta testers

Thank you for helping make EnviroFlow documentation better!

---

**Last Updated:** 2026-01-24

**Documentation Version:** 2.0.0

**Feedback:** docs@enviroflow.app
