Contributing to Project Tracker

##### Branching Strategy #####

We use a simplified GitFlow model:

- `main` – Stable, production-ready code
- `develop` – Latest development updates
- `feature/<feature-name>` – For new features
- `bugfix/<bug-name>` – For bug fixes
- `hotfix/<fix-name>` – Urgent fixes on `main`

##### Contribution Steps #####

1. *Clone* the repository.
2. *Create a branch* from `develop`:
   git checkout develop
   git checkout -b feature/your-feature-name
3. *Make your changes.*

4. *Write an easy to understand commit messages:*
git commit -m "Add user registration form"

6. *Push to GitHub:*
git push origin feature/your-feature-name

7. *Open a Pull Request to develop.*

##### Code Guidelines #####
Follow Django best practices.
Add docstrings and meaningful variable names.

##### Folder Structure #####
users/ – Auth and profile features

projects/ – Project-related models and views

tasks/ – Task management

comments/ – User comments on tasks

##### Testing #####
Run tests before pushing


##### License #####
By contributing, you agree that your code will be licensed under this project’s open source license.

Happy coding! 💻
