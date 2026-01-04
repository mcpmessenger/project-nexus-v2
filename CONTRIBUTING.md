# Contributing to Project Nexus v2

Thank you for your interest in contributing to Project Nexus v2! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report, please check if the issue has already been reported:

1. Check the [Issues](https://github.com/mcpmessenger/project-nexus-v2/issues) page
2. Search for similar issues using keywords
3. If it doesn't exist, create a new issue with:
   - A clear, descriptive title
   - Steps to reproduce the issue
   - Expected vs. actual behavior
   - Environment details (OS, Node version, etc.)
   - Screenshots if applicable

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

1. Check if the enhancement has already been suggested
2. Use a clear, descriptive title
3. Provide a detailed description of the proposed enhancement
4. Explain why this enhancement would be useful
5. List any potential drawbacks or considerations

### Pull Requests

1. **Fork the repository** and create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Write clean, readable code
   - Follow the existing code style and conventions
   - Add comments for complex logic
   - Update documentation if needed

3. **Test your changes**:
   ```bash
   pnpm lint    # Check for linting errors
   pnpm build   # Ensure everything compiles
   ```

4. **Commit your changes**:
   - Use clear, descriptive commit messages
   - Follow conventional commit format when possible:
     - `feat:` for new features
     - `fix:` for bug fixes
     - `docs:` for documentation changes
     - `style:` for formatting changes
     - `refactor:` for code refactoring
     - `test:` for adding tests
     - `chore:` for maintenance tasks

   Example:
   ```bash
   git commit -m "feat: Add workflow diagram component to landing page"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request**:
   - Provide a clear title and description
   - Reference any related issues
   - Describe what changes were made and why
   - Include screenshots for UI changes
   - Ensure all CI checks pass

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm 10.x
- Git

### Getting Started

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/your-username/project-nexus-v2.git
   cd project-nexus-v2-main
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your configuration values.

4. **Run the development server**:
   ```bash
   pnpm dev
   ```

5. **Verify the setup**:
   ```bash
   pnpm lint
   pnpm build
   ```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Define proper types and interfaces
- Avoid using `any` type when possible
- Use meaningful variable and function names

### Code Style

- Follow the existing code formatting (Prettier is configured)
- Use 2 spaces for indentation
- Use single quotes for strings (unless escaping quotes)
- Add trailing commas in multi-line structures
- Use async/await instead of Promises when possible

### Component Structure

- Use functional components with hooks
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Use proper prop types/interfaces

### File Organization

- Place components in the `components/` directory
- Use kebab-case for file names (e.g., `workflow-diagram.tsx`)
- Group related components in subdirectories when needed
- Keep utility functions in the `lib/` directory

## Areas for Contribution

We welcome contributions in these areas:

### High Priority

- **MCP Server Adapters**: Implement additional MCP server integrations
- **Testing**: Add unit tests, integration tests, or E2E tests
- **Documentation**: Improve docs, add examples, or fix typos
- **Bug Fixes**: Fix reported issues

### Medium Priority

- **UI/UX Improvements**: Enhance the user interface and experience
- **Performance**: Optimize workflows, reduce latency, improve scalability
- **Accessibility**: Improve keyboard navigation, screen reader support, etc.
- **Monitoring**: Enhance observability and alerting

### Nice to Have

- **Examples**: Add example workflows or use cases
- **Tutorials**: Create step-by-step guides
- **Localization**: Add support for additional languages

## Review Process

1. All pull requests require at least one review
2. Maintainers will review your PR and may request changes
3. Please respond to feedback in a timely manner
4. Once approved, a maintainer will merge your PR

## Questions?

- Open an issue with the `question` label
- Check the [documentation](docs/) directory
- Review existing issues and discussions

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

Thank you for contributing to Project Nexus v2! 🚀
