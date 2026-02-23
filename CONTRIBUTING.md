# Contributing to Homeland Discord Bot

We're excited that you're interested in contributing! This document outlines the process and guidelines.

## 🌟 Ways to Contribute

- 🐛 Report bugs
- 💡 Suggest features
- 📝 Improve documentation
- 🧪 Write tests
- 🎨 Design UI/UX improvements
- 🔧 Submit bug fixes
- ✨ Add new features

## 🚀 Getting Started

### 1. Fork & Clone
```bash
git clone https://github.com/yourusername/homeland-discord-bot.git
cd homeland-discord-bot
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 4. Run Database Migrations
```bash
npx prisma migrate dev
npx prisma generate
```

### 5. Run Tests
```bash
npm test
```

### 6. Start Development
```bash
npm run dev
```

## 📋 Development Guidelines

### Code Style
- Use ESLint configuration
- Follow existing code patterns
- Write clear, descriptive variable names
- Add comments for complex logic

### Commits
Follow conventional commits:
```
feat: Add PvP ranking system
fix: Correct gold calculation in trading
docs: Update deployment guide
test: Add enhancement system tests
refactor: Simplify combat logic
```

### Pull Requests
1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Ensure all tests pass
5. Update documentation
6. Submit PR with clear description

### Testing
- Write tests for new features
- Maintain >80% code coverage
- Run `npm test` before submitting

## 🏗️ Project Structure

```
homeland-discord-bot/
├── src/
│   ├── bot.js              # Main bot entry
│   ├── commands/           # Slash commands
│   ├── game/               # Game logic
│   ├── handlers/           # Event handlers
│   ├── database/           # Prisma client
│   └── utils/              # Utilities
├── tests/                  # Test suites
├── prisma/                 # Database schema
├── docs/                   # Documentation
└── package.json
```

## 🧪 Testing Strategy

### Unit Tests
- Game logic (combat, enhancement, quests)
- Utility functions
- Data transformations

### Integration Tests
- Command handlers
- Database operations
- API integrations

### Manual Testing
- Discord bot interactions
- Premium features
- Payment flows

## 📝 Documentation

When adding features:
1. Update README.md
2. Add JSDoc comments
3. Create/update relevant docs in `docs/`
4. Add examples if applicable

## 🐛 Bug Reports

Good bug reports include:
- Clear title
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)
- Environment (OS, Node version, etc.)

Use the issue template:
```markdown
**Bug Description**
[Clear description]

**Steps to Reproduce**
1. Run `/play`
2. Select warrior
3. ...

**Expected**
[What should happen]

**Actual**
[What actually happened]

**Environment**
- OS: macOS 14.0
- Node: v22.22.0
- Discord.js: v14.x
```

## 💡 Feature Requests

Good feature requests include:
- Clear problem statement
- Proposed solution
- Alternative solutions
- Benefits/use cases
- Implementation suggestions (optional)

## 🔐 Security

Report security vulnerabilities privately:
- Email: security@homeland-bot.com
- Do not create public issues for security bugs

## 🎯 Priority Areas

We're especially interested in:
1. **Performance optimization**
2. **New game features**
3. **UI/UX improvements**
4. **Test coverage**
5. **Documentation**

## 💬 Communication

- GitHub Issues: Bug reports, feature requests
- GitHub Discussions: General questions, ideas
- Discord: Real-time chat (coming soon)

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

All contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Eligible for premium account (for significant contributions)

## ❓ Questions?

Feel free to ask in:
- GitHub Discussions
- Discord server (coming soon)
- Email: support@homeland-bot.com

---

Thank you for contributing! 🎉
