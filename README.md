# Getting Started app for Discord

This project contains a basic rock-paper-scissors-style Discord app written in JavaScript, built for the [getting started guide](https://discord.com/developers/docs/getting-started).

![Demo of app](https://github.com/discord/discord-example-app/raw/main/assets/getting-started-demo.gif?raw=true)

## Project Structure

```text
├── examples/       -> feature-specific Discord examples
├── migrations/     -> D1 database migrations
├── app.js          -> Cloudflare Worker interactions handler
├── commands.js     -> slash command registration
├── game.js         -> rock-paper-scissors game logic
├── utils.js        -> Discord API helpers
├── wrangler.jsonc  -> Worker and D1 configuration
└── package.json
```

## Deploying to Cloudflare

The app runs as a Cloudflare Worker and stores active games in D1. The Workers Free plan currently includes up to 100,000 requests per day. D1 includes up to 5 million rows read and 100,000 rows written per day, with 5 GB total storage. Limits are shared across your Cloudflare account; requests may fail if a free limit is exceeded. Check the current [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) before deploying.

You'll need [Node.js](https://nodejs.org/en/download/), a [Cloudflare account](https://dash.cloudflare.com/sign-up), and a [Discord application](https://discord.com/developers/applications) configured for application commands. Install the project dependencies:

```sh
npm install
```

Log in to Cloudflare and create the D1 database. Copy the returned `database_id` into `wrangler.jsonc`, replacing the placeholder value:

```sh
npx wrangler login
npx wrangler d1 create discord-example-games
```

Apply the schema to the remote database:

```sh
npx wrangler d1 migrations apply discord-example-games --remote
```

Deploy once to create the Worker:

```sh
npm run deploy
```

Set the Discord app ID, bot token, and public key as Worker secrets. Run each command and enter its value when prompted. Each command publishes a new Worker version:

```sh
npx wrangler secret put APP_ID
npx wrangler secret put DISCORD_TOKEN
npx wrangler secret put PUBLIC_KEY
```

Set the Discord application's **Interactions Endpoint URL** to the deployed Worker URL followed by `/interactions`, for example `https://discord-example-app.<your-subdomain>.workers.dev/interactions`.

Register the slash commands from a local `.env` file containing `APP_ID` and `DISCORD_TOKEN`:

```sh
npm run register
```

## Local Development

Create `.dev.vars` with your local Discord credentials (`PUBLIC_KEY`, `APP_ID`, and `DISCORD_TOKEN`). Initialize the local database and start Wrangler:

```sh
npx wrangler d1 migrations apply discord-example-games --local
npm run dev
```

To test interactions with Discord during development, expose Wrangler's local port `8787` through an HTTPS tunnel and set its URL with `/interactions` as the endpoint.

## Other resources
- Read **[the documentation](https://discord.com/developers/docs/intro)** for in-depth information about API features.
- Browse the `examples/` folder in this project for smaller, feature-specific code examples
- Join the **[Discord Developers server](https://discord.gg/discord-developers)** to ask questions about the API, attend events hosted by the Discord API team, and interact with other devs.
- Check out **[community resources](https://discord.com/developers/docs/topics/community-resources#community-resources)** for language-specific tools maintained by community members.
