# Faafu Atoll School Marks

Internal marks entry, student reports, results, and teacher administration portal for Faafu Atoll School.

## Suggested GitHub repository

- **Repository name:** `faafu-atoll-school-marks`
- **Description:** `Faafu Atoll School internal marks entry, student reports, results, and teacher administration portal.`
- **Automatic deployment:** `Deploy Faafu Atoll School Marks`
- **Workflow file:** `.github/workflows/deploy-pages.yml`

## Upload to GitHub

Upload the project contents while keeping the folder structure. The important items are:

- `src/`
- `public/` including `public/png.png`
- `supabase/`
- `.github/workflows/deploy-pages.yml`
- `index.html`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `tailwind.config.js`
- `postcss.config.js`
- `tsconfig.json`
- `tsconfig.app.json`
- `tsconfig.node.json`
- `eslint.config.js`
- `.gitignore`

Do not upload `.env`, `node_modules`, or `dist`. The `.bolt` folder is not required for hosting this application.

## GitHub Pages setup

1. Create a repository using the suggested name and description.
2. Upload the project contents to the `main` branch.
3. Open **Settings → Secrets and variables → Actions** and add these repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Never add the Supabase service-role key to GitHub or to browser code.
5. Open **Settings → Pages** and choose **GitHub Actions** as the build source.
6. The workflow named `Deploy Faafu Atoll School Marks` will build and publish the site after every update to `main`.

The workflow is configured for the repository name `faafu-atoll-school-marks`. If the repository name is changed, update `VITE_BASE_PATH` in `.github/workflows/deploy-pages.yml` to match the new repository path.

## Branding

The school logo in `public/png.png` is used for the browser favicon and social-media preview image. The page title and description use the school name and marks portal description.

## Database

The `supabase/` folder contains the database migrations and Edge Functions used by the application. The hosted Supabase project remains the application backend; GitHub Pages hosts the web interface.
