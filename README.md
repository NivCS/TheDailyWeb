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
- Story cards show a headline, image, summary, category, author, publication date, reading time, and view count. Direct article requests return the full article content in the initial server-rendered HTML.
- Selecting a story opens its full article in the same app; read state is remembered in the browser.
- Article pages show comments and let visitors post without refreshing the comment list.
- Guest comments are limited on the server to three per device in a rolling 60-second window. The browser receives an HTTP-only device cookie; rate-limit counters are stored in MongoDB.
- Reporter article drafts are owned by the signed-in reporter, autosave to MongoDB, and move through draft, pending, returned, and published editorial workflow states. Submitted changes to published articles are stored separately from the public version.
- The reporter workspace filters by workflow status, sorts by last updated time, and supports the `Other` article category.
- Public home and article pages show Tel Aviv weather in Celsius. A shared MongoDB cache and refresh lock limit Open-Meteo requests to one refresh per five minutes across server workers.
- Sample stories include published and pending states so the public feed visibility rule can be demonstrated.

## Project structure

- `models/Comment.js` and `models/CommentRateLimit.js` — comment and guest rate-limit schemas.
- `models/Article.js` — article records, reporter ownership, editorial status, and separate working copies.
- `models/WeatherCache.js` and `services/weather.js` — shared cached Open-Meteo weather data and refresh coordination.
- `models/ArticleViewBucket.js` and `models/ArticlePublicationEvent.js` — sharded view history and publication history. Each article stores its lifetime view total and reading time.
- `data/articleStore.js` — MongoDB article data access.
- `data/reporterArticleStore.js` and `controllers/reporterController.js` — reporter ownership, draft autosave, and submission workflow.
- `data/commentStore.js` — comment reads/writes and atomic guest rate-limit reservations.
- `controllers/articleController.js` and `controllers/commentController.js` — request handling and input normalization.
- `routes/articleRoutes.js` — REST endpoints for the public article list, article detail, and comments.
- `routes/weatherRoutes.js` and `controllers/weatherController.js` — public current-weather endpoint.
- `routes/authRoutes.js` — protected reporter/editor pages and workflow/analytics API endpoints.
- `data/analyticsStore.js` and `controllers/analyticsController.js` — five-minute readership recording and editor analytics queries.
- `views/editor-analytics.ejs` and `public/js/editor-analytics.js` — editor chart and publication markers.
- `views/home.ejs` — page template and shared navigation/footer.
- `public/js/home.js` and `public/css/styles.css` — client-side feed behavior and responsive styling.

The application follows an MVC-style structure: routes apply role checks, controllers handle HTTP requests, data stores encapsulate database operations, and Mongoose models define persisted records. Article creation, editing, review, publication, and deletion follow the reporter/editor workflow described below.

## Impact analytics

- Only editors can open `/editor/analytics` or its article analytics API. The page supports 1-hour, 24-hour, 7-day, 30-day, and 90-day ranges.
- A successful request for a published article increments its lifetime total and one five-minute bucket in the same transaction. Each bucket is split across eight counter shards so concurrent readers do not all write to one counter document.
- The chart uses Chart.js with publication markers. New publication and approved-update events are written in the same MongoDB transaction as the article change.
- Each article stores a lifetime view total. View history is also written to five-minute buckets split across eight shards; the editor chart groups longer ranges into hourly points and marks publication and approved-update events.
- Published dates represent the first time an article became public. Later approved changes are recorded as publication events, so analytics can show the update without changing the original publication date.
- For a fresh demonstration dataset, set `MONGODB_URI` and run `npm run seed-demo-data -- --replace`. This replaces article, comment, view-bucket, and publication-event data with 500 synthetic articles dated across the previous two months. It preserves existing accounts and adds reporter accounts if needed. New account passwords are written only to the Git-ignored `.demo-credentials.txt` file.
- Demo content, comments, readership figures, and dates are fabricated for coursework demonstrations; they are not reports of real events.

## Accounts and authentication

- Public visitors are guests and do not need accounts.
- Reporter and editor accounts are created by running `npm run create-user` in an interactive terminal. The password is entered without echoing to the screen; do not add accounts or passwords to source control.
- Passwords are hashed with Node.js `crypto.scrypt`; the original password is not stored.
- Successful sign-in creates a random, HTTP-only cookie and a MongoDB-backed session that lasts seven days and remains valid across server restarts.
- `/reporter` and `/editor` are protected on the server. A logged-in user with the wrong role receives an access-denied response.
- In production, serve the app over HTTPS and set `NODE_ENV=production` so session cookies use the `Secure` attribute.
