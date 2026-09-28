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
- Article pages show comments and let visitors post without refreshing the comment list.
- Guest comments are limited on the server to three per device in a rolling 60-second window. The browser receives an HTTP-only device cookie; rate-limit counters are stored in MongoDB.
- Reporter article drafts are owned by the signed-in reporter, autosave to MongoDB, and move through draft, pending, returned, and published editorial workflow states. Submitted changes to published articles are stored separately from the public version.
- The reporter workspace filters by workflow status, sorts by last updated time, and supports the `Other` article category.
- Sample stories include published and pending states so the public feed visibility rule can be demonstrated.

## Project structure

- `models/Comment.js` and `models/CommentRateLimit.js` — comment and guest rate-limit schemas.
- `models/Article.js` — article records, reporter ownership, editorial status, and separate working copies.
- `models/ArticleAnalytics.js`, `models/ArticleViewBucket.js`, and `models/ArticlePublicationEvent.js` — readership baseline, hourly counters, and publication history.
- `data/articleStore.js` — MongoDB article data access.
- `data/reporterArticleStore.js` and `controllers/reporterController.js` — reporter ownership, draft autosave, and submission workflow.
- `data/commentStore.js` — comment reads/writes and atomic guest rate-limit reservations.
- `controllers/articleController.js` and `controllers/commentController.js` — request handling and input normalization.
- `routes/articleRoutes.js` — REST endpoints for the public article list, article detail, and comments.
- `routes/authRoutes.js` — protected reporter/editor pages and workflow/analytics API endpoints.
- `data/analyticsStore.js` and `controllers/analyticsController.js` — hourly readership recording and editor analytics queries.
- `views/editor-analytics.ejs` and `public/js/editor-analytics.js` — editor chart and publication markers.
- `views/home.ejs` — page template and shared navigation/footer.
- `public/js/home.js` and `public/css/styles.css` — client-side feed behavior and responsive styling.

The application follows an MVC-style structure: routes apply role checks, controllers handle HTTP requests, data stores encapsulate database operations, and Mongoose models define persisted records. Article creation, editing, review, publication, and deletion follow the reporter/editor workflow described below.

## Impact analytics

- Only editors can open `/editor/analytics` or its article analytics API. The page supports 1-hour, 24-hour, 7-day, 30-day, and 90-day ranges.
- A successful request for a published article records one view in a five-minute bucket. Each article bucket is split across eight counter shards so concurrent readers do not all write to one counter document.
- The chart uses Chart.js with publication markers. New publication and approved-update events are written in the same MongoDB transaction as the article change.
- Each article has one analytics record for the lifetime total carried into tracking and the tracking start time; five-minute increments use the same eight-shard counter structure for every article; the chart groups longer periods into hourly points. Article records do not store view counts. The chart shows cumulative lifetime totals over the selected time range, with publication and approved-update markers. Earlier hourly changes cannot be reconstructed from the previous lifetime-only counter.
- For a fresh or updated environment, set `MONGODB_URI` and run `npm run migrate-analytics`. The migration is safe to rerun: it creates missing indexes and fills analytics records/events only when absent.

## Accounts and authentication

- Public visitors are guests and do not need accounts.
- Reporter and editor accounts are created by running `npm run create-user` in an interactive terminal. The password is entered without echoing to the screen; do not add accounts or passwords to source control.
- Passwords are hashed with Node.js `crypto.scrypt`; the original password is not stored.
- Successful sign-in creates a random, HTTP-only cookie and a MongoDB-backed session that lasts seven days and remains valid across server restarts.
- `/reporter` and `/editor` are protected on the server. A logged-in user with the wrong role receives an access-denied response.
- In production, serve the app over HTTPS and set `NODE_ENV=production` so session cookies use the `Secure` attribute.
