const tf = require('@tensorflow/tfjs-node');
const fs = require('fs-extra');
const sharp = require('sharp');
const path = require('path');

/**
 * Base ML Model Class for Food Safety Detection
 */
class FoodSafetyBaseModel {
  constructor(modelConfig) {
    this.modelConfig = modelConfig;
    this.model = null;
    this.isLoaded = false;
    this.inputShape = modelConfig.inputShape || [224, 224, 3];
    this.numClasses = modelConfig.numClasses;
    this.modelType = modelConfig.modelType;
  }

  /**
   * Preprocess image for model input
   */
  async preprocessImage(imagePath) {
    try {
      // Read and resize image
      const buffer = await fs.readFile(imagePath);
      const processedImage = await sharp(buffer)
        .resize(this.inputShape[0], this.inputShape[1])
        .removeAlpha()
        .raw()
        .toBuffer();

      // Convert to tensor and normalize
      const tensor = tf.tensor3d(
        new Uint8Array(processedImage),
        [this.inputShape[0], this.inputShape[1], this.inputShape[2]]
      );

      // Normalize pixel values to [0,1]
      const normalized = tensor.div(255.0);
      
      return normalized;
    } catch (error) {
      throw new Error(`Image preprocessing failed: ${error.message}`);
    }
  }

  /**
   * Build CNN model architecture
   */
  buildModel() {
    const model = tf.sequential({
      layers: [
        // First Convolutional Block
        tf.layers.conv2d({
          inputShape: this.inputShape,
          filters: 32,
          kernelSize: 3,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }),
        tf.layers.dropout({ rate: 0.25 }),

        // Second Convolutional Block
        tf.layers.conv2d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }),
        tf.layers.dropout({ rate: 0.25 }),

        // Third Convolutional Block
        tf.layers.conv2d({
          filters: 128,
          kernelSize: 3,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }),
        tf.layers.dropout({ rate: 0.25 }),

        // Fourth Convolutional Block
        tf.layers.conv2d({
          filters: 256,
          kernelSize: 3,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }),
        tf.layers.dropout({ rate: 0.3 }),

        // Global Average Pooling
        tf.layers.globalAveragePooling2d(),

        // Dense layers
        tf.layers.dense({
          units: 512,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.dropout({ rate: 0.5 }),
        tf.layers.dense({
          units: 256,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.dropout({ rate: 0.4 }),

        // Output layer
        tf.layers.dense({
          units: this.numClasses,
          activation: 'softmax'
        })
      ]
    });

    return model;
  }

  /**
   * Compile model with appropriate optimizer and loss function
   */
  compileModel() {
    const optimizer = tf.train.adam(0.001);
    
    this.model.compile({
      optimizer: optimizer,
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    console.log(`✅ ${this.modelType} model compiled successfully`);
  }

  /**
   * Train the model
   */
  async train(trainingData, validationData, epochs = 50) {
    try {
      this.model = this.buildModel();
      this.compileModel();

      console.log(`🚀 Training ${this.modelType} model...`);

      const history = await this.model.fit(trainingData, {
        epochs: epochs,
        batchSize: 32,
        validationData: validationData,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch + 1}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.accuracy.toFixed(4)}, val_loss = ${logs.val_loss.toFixed(4)}, val_accuracy = ${logs.val_accuracy.toFixed(4)}`);
          }
        }
      });

      await this.saveModel();
      console.log(`✅ ${this.modelType} model training completed!`);

      return history;
    } catch (error) {
      console.error(`❌ Training failed:`, error);
      throw error;
    }
  }

  /**
   * Make predictions
   */
  async predict(imagePath) {
    try {
      if (!this.isLoaded) {
        await this.loadModel();
      }

      const preprocessedImage = await this.preprocessImage(imagePath);
      const prediction = this.model.predict(preprocessedImage);
      const result = await prediction.data();

      // Cleanup tensors
      preprocessedImage.dispose();
      prediction.dispose();

      return this.processPrediction(result);
    } catch (error) {
      throw new Error(`Prediction failed: ${error.message}`);
    }
  }

  /**
   * Process model output
   */
  processPrediction(output) {
    // This will be overridden by specific models
    return {
      confidence: Math.max(...output),
      class: output.indexOf(Math.max(...output)),
      probabilities: Array.from(output)
    };
  }

  /**
   * Save model to disk
   */
  async saveModel() {
    const modelPath = path.join(__dirname, '..', 'models', `${this.modelType}_model`);
    await this.model.save(`file://${modelPath}`);
    console.log(`💾 ${this.modelType} model saved to ${modelPath}`);
  }

  /**
   * Load model from disk
   */
  async loadModel() {
    try {
      const modelPath = path.join(__dirname, '..', 'models', `${this.modelType}_model`);
      this.model = await tf.loadLayersModel(`file://${modelPath}/model.json`);
      this.isLoaded = true;
      console.log(`📥 ${this.modelType} model loaded successfully`);
    } catch (error) {
      console.warn(`⚠️  ${this.modelType} model not found, will need to train first`);
      this.isLoaded = false;
    }
  }

  /**
   * Get model summary
   */
  getModelSummary() {
    if (this.model) {
      this.model.summary();
    }
  }

  /**
   * Cleanup resources
   */
  dispose() {
    if (this.model) {
      this.model.dispose();
    }
  }
}

module.exports = FoodSafetyBaseModel;