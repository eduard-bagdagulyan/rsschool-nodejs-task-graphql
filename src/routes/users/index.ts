import { FastifyPluginAsyncJsonSchemaToTs } from '@fastify/type-provider-json-schema-to-ts';
import { idParamSchema } from '../../utils/reusedSchemas';
import {
  createUserBodySchema,
  changeUserBodySchema,
  subscribeBodySchema,
} from './schemas';
import type { UserEntity } from '../../utils/DB/entities/DBUsers';
import { isValidUUID } from '../../utils/misc';

const plugin: FastifyPluginAsyncJsonSchemaToTs = async (
  fastify
): Promise<void> => {
  fastify.get('/', async function (request, reply): Promise<UserEntity[]> {
    return this.db.users.findMany()
  });

  fastify.get(
    '/:id',
    {
      schema: {
        params: idParamSchema,
      },
    },
    async function (request, reply): Promise<UserEntity> {
      const user = await this.db.users.findOne({ key: 'id', equals: request.params.id })

      if (!user) {
        reply.code(404)
        throw new Error('User not found')
      }

      return user
    }
  );

  fastify.post(
    '/',
    {
      schema: {
        body: createUserBodySchema,
      },
    },
    async function (request, reply): Promise<UserEntity> {
      return this.db.users.create(request.body)
    }
  );

  fastify.delete(
    '/:id',
    {
      schema: {
        params: idParamSchema,
      },
    },
    async function (request, reply): Promise<UserEntity> {
      const userId = request.params.id

      if (!isValidUUID(userId)) {
        reply.code(400)
        throw new Error('Bad Request')
      }

      const user = await this.db.users.findOne({ key: 'id', equals: userId })
      if (!user) {
        reply.code(404)
        throw new Error('User not found')
      }

      const subscribedUsers = await this.db.users.findMany({ key: 'subscribedToUserIds', inArray: userId })
      for (const user of subscribedUsers) {
        const userWithRemovedSubscriber = {
          ...user,
          subscribedToUserIds: user.subscribedToUserIds.filter(value => value !== userId)
        }
        await this.db.users.change(user.id, userWithRemovedSubscriber)
      }

      const userProfiles = await this.db.profiles.findMany({ key: 'userId', equals: userId })
      if (userProfiles && userProfiles.length > 0) {
        for (const userProfile of userProfiles) {
          await this.db.profiles.delete(userProfile.id)
        }
      }

      const userPosts = await this.db.posts.findMany({ key: 'userId', equals: userId })
      if (userPosts && userPosts.length > 0) {
        for (const userPost of userPosts) {
          await this.db.posts.delete(userPost.id)
        }
      }

      await this.db.users.delete(userId)
      return user
    }
  );

  fastify.post(
    '/:id/subscribeTo',
    {
      schema: {
        body: subscribeBodySchema,
        params: idParamSchema,
      },
    },
    async function (request, reply): Promise<UserEntity> {
      const subscribeUser = await this.db.users.findOne({ key: 'id', equals: request.params.id })
      const targetUser = await this.db.users.findOne({ key: 'id', equals: request.body.userId })

      if (!subscribeUser || !targetUser) {
        reply.code(404)
        throw new Error('User not found')
      }

      targetUser.subscribedToUserIds = Array.from(new Set([...targetUser.subscribedToUserIds, request.params.id]))

      return this.db.users.change(targetUser.id, targetUser)
    }
  );

  fastify.post(
    '/:id/unsubscribeFrom',
    {
      schema: {
        body: subscribeBodySchema,
        params: idParamSchema,
      },
    },
    async function (request, reply): Promise<UserEntity> {
      const unsubscribeUser = await this.db.users.findOne({key: 'id', equals: request.params.id})
      const targetUser = await this.db.users.findOne({ key: 'id', equals: request.body.userId })

      if (!unsubscribeUser || !targetUser) {
        reply.code(404)
        throw new Error('User not found')
      }

      if (!targetUser.subscribedToUserIds.includes(unsubscribeUser.id)) {
        reply.code(400)
        throw new Error('User is not subscribed')
      }

      targetUser.subscribedToUserIds = targetUser.subscribedToUserIds.filter(value => value !== unsubscribeUser.id)

      return this.db.users.change(targetUser.id, targetUser)
    }
  );

  fastify.patch(
    '/:id',
    {
      schema: {
        body: changeUserBodySchema,
        params: idParamSchema,
      },
    },
    async function (request, reply): Promise<UserEntity> {
      const userId = request.params.id

      if (!isValidUUID(userId)) {
        reply.code(400)
        throw new Error('User not found')
      }

      return this.db.users.change(userId, request.body)
    }
  );
};

export default plugin;
