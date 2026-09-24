# The Daily Web

An English-language news homepage built as the first step of the course project. The home page presents approved, published sample articles and loads article data through an asynchronous REST API.

## Run locally

1. Install Node.js 18 or newer.
2. From this folder, run `npm install`.
3. Run `npm start` and open `http://localhost:3000`.

The application requires MongoDB Atlas. Set `MONGODB_URI` in a local `.env` file using the Atlas connection string. Article data is read from and stored in Atlas; the app does not use a local article-data fallback.

## Homepage features

- Public feed includes only approved, published stories.
- Infinite scrolling loads up to 20 additional stories per request.
- Search matches headline, summary, category, and reporter without a full-page refresh.
- Category, read/unread, and publication-date/popularity filters update through AJAX requests.
- Story cards show a headline, image, summary, category, author, and publication date.
- Selecting a story opens its full article in the same app; read state is remembered in the browser.
- Sample stories include published and pending states so the public feed visibility rule can be demonstrated.

## Project structure

- `models/Article.js` — Mongoose article schema.
- `data/articleStore.js` — MongoDB article data access.
- `controllers/articleController.js` — request handling and input normalization.
- `routes/articleRoutes.js` — REST endpoints for the public article list and article detail.
- `views/home.ejs` — page template and shared navigation/footer.
- `public/js/home.js` and `public/css/styles.css` — client-side feed behavior and responsive styling.

The current milestone covers the public home page and read endpoints. The remaining role-specific workflows and create/update/delete operations can be added in later steps while extending the same MVC structure.
