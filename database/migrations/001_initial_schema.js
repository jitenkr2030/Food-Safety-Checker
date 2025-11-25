/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Basic info
    table.string('email', 255).notNullable().unique();
    table.string('password', 255).notNullable();
    table.string('first_name', 100).notNullable();
    table.string('last_name', 100).notNullable();
    table.string('phone', 20);
    
    // Personal details
    table.date('date_of_birth');
    table.enum('gender', ['male', 'female', 'other']);
    table.decimal('height', 5, 2); // in cm
    table.decimal('weight', 5, 2); // in kg
    table.enum('activity_level', ['sedentary', 'light', 'moderate', 'active', 'very_active']);
    
    // Health information
    table.json('dietary_restrictions').defaultTo('[]');
    table.json('health_conditions').defaultTo('[]');
    table.json('allergies').defaultTo('[]');
    table.json('preferences').defaultTo('{}');
    
    // Location
    table.json('location'); // { latitude, longitude, address }
    
    // Media
    table.string('avatar', 500);
    
    // Settings
    table.string('preferred_language', 10).defaultTo('en');
    table.string('timezone', 50).defaultTo('UTC');
    
    // Email verification
    table.string('email_verification_token', 255);
    table.boolean('email_verified').defaultTo(false);
    
    // Phone verification
    table.boolean('phone_verified').defaultTo(false);
    
    // Two-factor authentication
    table.boolean('two_factor_enabled').defaultTo(false);
    table.string('two_factor_secret', 255);
    
    // Login tracking
    table.timestamp('last_login_at');
    table.integer('login_attempts').defaultTo(0);
    table.timestamp('locked_until');
    
    // Account status
    table.boolean('is_active').defaultTo(true);
    
    // Premium status
    table.boolean('is_premium').defaultTo(false);
    table.timestamp('premium_expires_at');
    
    // Password reset
    table.string('password_reset_token', 255);
    table.timestamp('password_reset_expires');
    
    // Push notifications
    table.string('push_token', 500);
    
    // Timestamps
    table.timestamps(true, true);
    
    // Indexes
    table.index(['email']);
    table.index(['phone']);
    table.index(['email_verified']);
    table.index(['is_active']);
    table.index(['is_premium']);
    table.index(['created_at']);
  })
  .then(() => {
    return knex.schema.createTable('food_items', function(table) {
      // Primary key
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      
      // Basic info
      table.string('name', 200).notNullable();
      table.string('category', 100);
      table.string('subcategory', 100);
      table.text('description');
      
      // Nutrition info (per 100g)
      table.decimal('calories', 8, 2);
      table.decimal('protein', 8, 2);
      table.decimal('carbohydrates', 8, 2);
      table.decimal('fat', 8, 2);
      table.decimal('fiber', 8, 2);
      table.decimal('sugar', 8, 2);
      table.decimal('sodium', 8, 2);
      table.decimal('cholesterol', 8, 2);
      
      // Vitamins and minerals (per 100g)
      table.decimal('vitamin_a', 8, 2);
      table.decimal('vitamin_c', 8, 2);
      table.decimal('vitamin_d', 8, 2);
      table.decimal('calcium', 8, 2);
      table.decimal('iron', 8, 2);
      table.decimal('potassium', 8, 2);
      
      // Health metrics
      table.decimal('glycemic_index', 5, 2);
      table.decimal('glycemic_load', 5, 2);
      table.enum('dietary_fiber', ['low', 'medium', 'high']);
      table.enum('oxalate_level', ['low', 'medium', 'high']);
      table.enum('purine_level', ['low', 'medium', 'high']);
      
      // Safety information
      table.json('allergens').defaultTo('[]');
      table.json('safety_warnings').defaultTo('[]');
      table.decimal('shelf_life_days', 5, 2);
      
      // Preparation info
      table.text('preparation_instructions');
      table.json('storage_instructions');
      table.enum('cooking_difficulty', ['easy', 'medium', 'hard']);
      
      // Visual characteristics for AI
      table.json('visual_features').defaultTo('{}');
      table.json('color_range').defaultTo('[]');
      table.json('texture_characteristics').defaultTo('[]');
      
      // Metadata
      table.string('image_url', 500);
      table.string('thumbnail_url', 500);
      table.enum('status', ['active', 'inactive', 'deprecated']).defaultTo('active');
      table.integer('confidence_score').defaultTo(0);
      
      // Timestamps
      table.timestamps(true, true);
      
      // Indexes
      table.index(['name']);
      table.index(['category']);
      table.index(['subcategory']);
      table.index(['status']);
      table.index(['created_at']);
    });
  })
  .then(() => {
    return knex.schema.createTable('food_analyses', function(table) {
      // Primary key
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      
      // Foreign key to user
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      
      // Food identification
      table.uuid('food_item_id').references('id').inTable('food_items').onDelete('SET NULL');
      table.string('food_name', 200);
      
      // Image information
      table.string('image_url', 500).notNullable();
      table.string('image_thumbnail', 500);
      table.integer('image_width');
      table.integer('image_height');
      table.string('image_format', 20);
      table.integer('image_size');
      
      // Analysis results
      table.integer('freshness_score').check('freshness_score >= 0 AND freshness_score <= 100');
      table.enum('overall_rating', ['excellent', 'very_good', 'good', 'fair', 'poor']).notNullable();
      
      // Safety metrics (JSON)
      table.json('safety_metrics').defaultTo('{}');
      table.json('nutrition_info').defaultTo('{}');
      table.json('recommendations').defaultTo('[]');
      table.json('warnings').defaultTo('[]');
      
      // AI confidence scores
      table.json('ai_confidence').defaultTo('{}');
      
      // Analysis details
      table.enum('analysis_type', ['basic', 'comprehensive', 'premium']).defaultTo('comprehensive');
      table.integer('analysis_duration'); // in milliseconds
      table.string('model_version', 50).defaultTo('1.0.0');
      
      // Processing status
      table.enum('processing_status', ['pending', 'processing', 'completed', 'failed']).defaultTo('pending');
      table.text('error_message');
      table.integer('retry_count').defaultTo(0);
      
      // Sharing and privacy
      table.boolean('is_deleted').defaultTo(false);
      table.boolean('is_shared').defaultTo(false);
      table.json('shared_with').defaultTo('[]'); // Array of user IDs
      table.json('tags').defaultTo('[]');
      
      // User notes
      table.text('notes');
      
      // Location and device info
      table.json('location'); // { latitude, longitude, address }
      table.json('device_info'); // Mobile device information
      
      // Timestamps
      table.timestamp('completed_at');
      table.timestamps(true, true);
      
      // Indexes
      table.index(['user_id']);
      table.index(['food_item_id']);
      table.index(['freshness_score']);
      table.index(['processing_status']);
      table.index(['created_at']);
      table.index(['is_deleted']);
      table.index(['is_shared']);
    });
  })
  .then(() => {
    return knex.schema.createTable('safety_metrics', function(table) {
      // Primary key
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()));
      
      // Reference to analysis
      table.uuid('analysis_id').notNullable().references('id').inTable('food_analyses').onDelete('CASCADE');
      
      // Metric type and score
      table.string('metric_type', 100).notNullable(); // oil_quality, burnt_food, spoilage, etc.
      table.enum('risk_level', ['safe', 'caution', 'danger']).notNullable();
      table.integer('score').check('score >= 0 AND score <= 100');
      
      // Metric details
      table.text('description');
      table.text('detailed_analysis');
      table.json('visual_indicators').defaultTo('{}');
      table.json('measurement_data').defaultTo('{}');
      
      // Timestamps
      table.timestamps(true, true);
      
      // Indexes
      table.index(['analysis_id']);
      table.index(['metric_type']);
      table.index(['risk_level']);
    });
  })
  .then(() => {
    return knex.schema.createTable('ml_models', function(table) {
      // Primary key
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      
      // Model information
      table.string('name', 200).notNullable();
      table.string('version', 50).notNullable();
      table.string('type', 100).notNullable(); // food_recognition, safety_detection, etc.
      table.text('description');
      
      // Model metadata
      table.string('model_path', 500);
      table.json('model_config').defaultTo('{}');
      table.json('training_data_info').defaultTo('{}');
      table.json('performance_metrics').defaultTo('{}');
      
      // Deployment info
      table.enum('status', ['training', 'testing', 'production', 'deprecated']).defaultTo('training');
      table.timestamp('deployed_at');
      table.timestamp('retired_at');
      
      // Accuracy and validation
      table.decimal('accuracy', 5, 4);
      table.decimal('precision', 5, 4);
      table.decimal('recall', 5, 4);
      table.decimal('f1_score', 5, 4);
      
      // Usage tracking
      table.bigInteger('total_predictions').defaultTo(0);
      table.integer('error_count').defaultTo(0);
      table.timestamp('last_used_at');
      
      // Timestamps
      table.timestamps(true, true);
      
      // Indexes
      table.index(['name', 'version']);
      table.index(['type']);
      table.index(['status']);
    });
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('ml_models')
    .then(() => knex.schema.dropTableIfExists('safety_metrics'))
    .then(() => knex.schema.dropTableIfExists('food_analyses'))
    .then(() => knex.schema.dropTableIfExists('food_items'))
    .then(() => knex.schema.dropTableIfExists('users'));
};