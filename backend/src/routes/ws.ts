import { Elysia, t } from "elysia";
import { messageService } from '../services/message.service';

export const ws = new Elysia({
  prefix: '/ws'
})
  .ws('/chat', {
    body: t.Object({
      type: t.Optional(t.String()),
      messageId: t.Optional(t.Number()),
      message: t.String(),
      receiver: t.Number()
    }),
    query: t.Object({
      userId: t.Nullable(t.Number())
    }),
    response: t.Object({
      type: t.String(),
      sender: t.Optional(t.Number()),
      message: t.String(),
      messageId: t.Optional(t.Number()),
      id: t.Optional(t.Number()),
      timestamp: t.Number()
    }),
    open: (ws) => {
      const userId = ws.data.query.userId;
      // Suscribirse al canal personal del usuario
      ws.subscribe(`user:${userId}`);
      ws.send({
        type: 'system',
        message: 'Connected to chat',
        timestamp: Date.now()
      });
    },
    message: async (ws, { message, receiver, type, messageId }) => {
      console.log(ws.data.query.userId);
      const sender = ws.data.query.userId as number;

      try {
        // Guardar el mensaje en la base de datos

        let msg: {
          id: number;
          content: string;
          createdAt: Date;
          edited: boolean;
          editedAt: Date;
          deletedFor: number | null;
          sentBy: number;
          chatId: number;
        };

        if (type === 'edit' && messageId) {
          console.log('editando mensaje');
          msg = await messageService.editMessage(Number(messageId), message, sender);
        } else {
          msg = await messageService.createMessage(message, sender, receiver);
        }

        // Enviar el mensaje al receptor
        ws.publish(`user:${receiver}`, {
          type: type || 'chat',
          message,
          messageId,
          sender,
          id: msg.id,
          timestamp: Date.now()
        });

        return {
          type: type || 'chat',
          message,
          messageId,
          sender,
          id: msg.id,
          timestamp: Date.now()
        };

      } catch (error) {
        console.error('Error saving message:', error);
        ws.send({
          type: 'system',
          message: 'Error saving message',
          timestamp: Date.now()
        });
      }
    },
    close: (ws) => {
      const userId = ws.data.query.userId;
      ws.unsubscribe(`user:${userId}`);
      ws.publish(`user:${userId}`, {
        type: 'system',
        message: 'Disconnected from chat',
        timestamp: Date.now()
      });
    }
  })
