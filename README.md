# The Daily Web

A full-stack news application built with Node.js, Express, EJS, and MongoDB for the course project.

Made by: Niv Meir, Stacy Greenberg, Amit Caspi, Lia Audri, Maya Yosef.


## Run locally

1. Install Node.js 18 or newer.
2. From this folder, run `npm install`.
3. Run `npm start` and open `http://localhost:3000`.

The application requires MongoDB Atlas. Set `MONGODB_URI` in a local `.env` file using the Atlas connection string. Article data is read from and stored in Atlas; the app does not use a local article-data fallback.


## Project structure

```text
TheDailyWeb/
|
|-- server.js                 Application entry point
|-- package.json              Commands and dependencies
|-- config/                   Shared configuration
|
|-- routes/                   URL and HTTP method definitions
|   |-- articleRoutes.js
|   |-- authRoutes.js
|   `-- weatherRoutes.js
|
|-- controllers/              Request and response handling
|   |-- articleController.js
|   |-- authController.js
|   |-- commentController.js
|   |-- editorController.js
|   |-- reporterController.js
|   |-- analyticsController.js
|   `-- weatherController.js
|
|-- data/                     Database operations
|   |-- articleStore.js
|   |-- commentStore.js
|   |-- reporterArticleStore.js
|   |-- editorArticleStore.js
|   `-- analyticsStore.js
|
|-- models/                   MongoDB document schemas
|   |-- Article.js
|   |-- Comment.js
|   |-- User.js
|   |-- Session.js
|   `-- ...
|
|-- middleware/               Reusable request checks
|-- services/                 Reusable business and external API logic
|
|-- views/                    EJS HTML templates
|   |-- home.ejs
|   |-- article.ejs
|   |-- login.ejs
|   `-- partials/
|
|-- public/                   Browser files
|   |-- js/                   AJAX and page behavior
|   `-- css/                  Styling
|
`-- scripts/                  Database and account utilities
```

## Core functionality

The Daily Web is an editorial news platform for publishing, reading, and managing online articles. Visitors can browse approved stories, search and filter the feed, open full articles, post comments, and view local weather information without full-page refreshes.

Implemented features include:

- Asynchronous article feed with infinite scrolling, search, categories, read/unread status, and popularity sorting.
- Server-rendered article pages with comments, view tracking, and guest comment rate limiting.
- Reporter accounts with owned drafts, autosave, article submission, and revision workflow.
- Editor accounts with article review, approval, return-for-revisions, publishing, comment moderation, and user management.
- Role-based authentication with secure password hashing and MongoDB-backed sessions.
- Reader analytics with lifetime views, time-based charts, and publication or update markers.
- Cached Tel Aviv weather data retrieved from the Open-Meteo API.