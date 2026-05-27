'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Detection extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Detection.init({
    className: DataTypes.STRING,
    confidence: DataTypes.FLOAT
  }, {
    sequelize,
    modelName: 'Detection',
  });
  return Detection;
};