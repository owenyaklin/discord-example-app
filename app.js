import {
  ButtonStyleTypes,
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKey,
} from 'discord-interactions';
import { getRandomEmoji, DiscordRequest } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function interactionResponse(data) {
  return jsonResponse(data);
}

function getUserId(interaction) {
  return interaction.context === 0
    ? interaction.member.user.id
    : interaction.user.id;
}

function scheduleDiscordRequest(ctx, endpoint, options, token) {
  ctx.waitUntil(
    DiscordRequest(endpoint, options, token).catch((error) => {
      console.error('Discord API request failed:', error);
    }),
  );
}

async function handleInteraction(interaction, env, ctx) {
  const { id, type, data } = interaction;

  if (type === InteractionType.PING) {
    return interactionResponse({ type: InteractionResponseType.PONG });
  }

  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    if (name === 'test') {
      return interactionResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: `hello world ${getRandomEmoji()}`,
            },
          ],
        },
      });
    }

    if (name === 'challenge' && id) {
      const userId = getUserId(interaction);
      const objectName = data.options[0].value;
      const now = Date.now();

      await env.DB.batch([
        env.DB.prepare('DELETE FROM active_games WHERE expires_at <= ?').bind(now),
        env.DB.prepare(
          `INSERT INTO active_games (game_id, user_id, object_name, expires_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(game_id) DO UPDATE SET
             user_id = excluded.user_id,
             object_name = excluded.object_name,
             expires_at = excluded.expires_at`,
        ).bind(id, userId, objectName, now + 24 * 60 * 60 * 1000),
      ]);

      return interactionResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: `Rock papers scissors challenge from <@${userId}>`,
            },
            {
              type: MessageComponentTypes.ACTION_ROW,
              components: [
                {
                  type: MessageComponentTypes.BUTTON,
                  custom_id: `accept_button_${id}`,
                  label: 'Accept',
                  style: ButtonStyleTypes.PRIMARY,
                },
              ],
            },
          ],
        },
      });
    }

    console.error(`unknown command: ${name}`);
    return jsonResponse({ error: 'unknown command' }, 400);
  }

  if (type === InteractionType.MESSAGE_COMPONENT) {
    const { custom_id: componentId } = data;

    if (componentId.startsWith('accept_button_')) {
      const gameId = componentId.slice('accept_button_'.length);
      const endpoint = `webhooks/${env.APP_ID}/${interaction.token}/messages/${interaction.message.id}`;
      scheduleDiscordRequest(ctx, endpoint, { method: 'DELETE' }, env.DISCORD_TOKEN);

      return interactionResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.EPHEMERAL | InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: 'What is your object of choice?',
            },
            {
              type: MessageComponentTypes.ACTION_ROW,
              components: [
                {
                  type: MessageComponentTypes.STRING_SELECT,
                  custom_id: `select_choice_${gameId}`,
                  options: getShuffledOptions(),
                },
              ],
            },
          ],
        },
      });
    }

    if (componentId.startsWith('select_choice_')) {
      const gameId = componentId.slice('select_choice_'.length);
      const { results } = await env.DB.prepare(
        `DELETE FROM active_games
         WHERE game_id = ? AND expires_at > ?
         RETURNING user_id, object_name`,
      ).bind(gameId, Date.now()).run();
      const game = results[0];

      if (!game) {
        return interactionResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: InteractionResponseFlags.EPHEMERAL,
            content: 'This game has expired or has already been played.',
          },
        });
      }

      const userId = getUserId(interaction);
      const resultStr = getResult(
        { id: game.user_id, objectName: game.object_name },
        { id: userId, objectName: data.values[0] },
      );
      const endpoint = `webhooks/${env.APP_ID}/${interaction.token}/messages/${interaction.message.id}`;
      scheduleDiscordRequest(
        ctx,
        endpoint,
        {
          method: 'PATCH',
          body: {
            components: [
              {
                type: MessageComponentTypes.TEXT_DISPLAY,
                content: `Nice choice ${getRandomEmoji()}`,
              },
            ],
          },
        },
        env.DISCORD_TOKEN,
      );

      return interactionResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: resultStr,
            },
          ],
        },
      });
    }

    return jsonResponse({ error: 'unknown component' }, 400);
  }

  console.error('unknown interaction type', type);
  return jsonResponse({ error: 'unknown interaction type' }, 400);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== '/interactions' || request.method !== 'POST') {
      return new Response('Not found', { status: 404 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get('X-Signature-Ed25519');
    const timestamp = request.headers.get('X-Signature-Timestamp');
    if (!signature || !timestamp || !(await verifyKey(rawBody, signature, timestamp, env.PUBLIC_KEY))) {
      return new Response('invalid request signature', { status: 401 });
    }

    let interaction;
    try {
      interaction = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: 'invalid JSON' }, 400);
    }

    try {
      return await handleInteraction(interaction, env, ctx);
    } catch (error) {
      console.error('Error handling interaction:', error);
      return jsonResponse({ error: 'internal server error' }, 500);
    }
  },
};
