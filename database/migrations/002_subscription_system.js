/**
 * Migration: Add Subscription Management Tables
 * Description: Adds subscription and usage tracking tables to support monetization
 */

module.exports = {
  up: async (knex) => {
    // Create subscriptions table
    await knex.schema.createTable('subscriptions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.enum('tier', ['free', 'premium', 'family', 'restaurant', 'business', 'enterprise']).notNullable();
      table.enum('status', ['active', 'canceled', 'expired', 'past_due']).defaultTo('active');
      table.enum('plan_type', ['monthly', 'yearly']).defaultTo('monthly');
      table.bigInteger('amount').notNullable(); // Amount in paisa
      table.string('currency', 3).defaultTo('INR');
      table.timestamp('start_date').notNullable();
      table.timestamp('end_date');
      table.timestamp('next_billing_date');
      table.timestamp('trial_end_date');
      table.timestamp('canceled_at');
      table.string('payment_provider').defaultTo('razorpay');
      table.string('provider_subscription_id');
      table.string('provider_customer_id');
      table.json('features').defaultTo('{}');
      table.json('usage_limits').defaultTo('{}');
      table.json('metadata').defaultTo('{}');
      table.timestamps(true, true);
      
      // Indexes
      table.index(['user_id', 'status']);
      table.index(['tier', 'status']);
      table.index('next_billing_date');
    });

    // Create usage_tracking table
    await knex.schema.createTable('usage_tracking', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.date('date').notNullable(); // YYYY-MM-DD format
      table.string('resource_type').notNullable(); // 'food_analysis', 'video_analysis', etc.
      table.integer('usage_count').defaultTo(0);
      table.timestamp('last_used_at').defaultTo(knex.fn.now());
      table.json('metadata').defaultTo('{}');
      table.timestamps(true, true);
      
      // Indexes
      table.unique(['user_id', 'date', 'resource_type']);
      table.index(['user_id', 'date']);
      table.index(['resource_type', 'date']);
    });

    // Update users table to support family members
    await knex.schema.table('users', (table) => {
      table.string('family_role').defaultTo('primary'); // 'primary', 'member'
      table.uuid('family_id'); // Links family members together
      table.json('subscription_preferences').defaultTo('{}');
    });

    // Create family_groups table
    await knex.schema.createTable('family_groups', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('family_name').notNullable();
      table.uuid('primary_member_id').references('id').inTable('users').onDelete('CASCADE');
      table.enum('subscription_tier', ['family']).defaultTo('family');
      table.integer('max_members').defaultTo(6);
      table.timestamp('subscription_start');
      table.timestamp('subscription_end');
      table.json('preferences').defaultTo('{}');
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
      
      // Indexes
      table.index(['primary_member_id']);
      table.index(['family_name']);
    });

    // Create family_members table
    await knex.schema.createTable('family_members', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('family_id').references('id').inTable('family_groups').onDelete('CASCADE');
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('member_role').defaultTo('member'); // 'admin', 'member'
      table.string('member_name').notNullable();
      table.json('member_preferences').defaultTo('{}');
      table.timestamp('joined_at').defaultTo(knex.fn.now());
      table.boolean('is_active').defaultTo(true);
      
      // Indexes
      table.unique(['family_id', 'user_id']);
      table.index(['family_id']);
    });

    // Add subscription management indexes
    await knex.raw('CREATE INDEX CONCURRENTLY idx_subscriptions_user_tier ON subscriptions(user_id, tier)');
    await knex.raw('CREATE INDEX CONCURRENTLY idx_subscriptions_billing ON subscriptions(next_billing_date) WHERE status = \'active\'');
    await knex.raw('CREATE INDEX CONCURRENTLY idx_usage_user_date ON usage_tracking(user_id, date)');
    
    console.log('✅ Subscription tables created successfully');
  },

  down: async (knex) => {
    // Drop tables in reverse order
    await knex.schema.dropTableIfExists('family_members');
    await knex.schema.dropTableIfExists('family_groups');
    await knex.schema.dropTableIfExists('usage_tracking');
    await knex.schema.dropTableIfExists('subscriptions');
    
    // Remove added columns from users table
    await knex.schema.table('users', (table) => {
      table.dropColumn('family_role');
      table.dropColumn('family_id');
      table.dropColumn('subscription_preferences');
    });
    
    console.log('✅ Subscription tables dropped successfully');
  }
};