module.exports = (sequelize, DataTypes) => {
	return sequelize.define('DBProcessQueue', {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		task: DataTypes.STRING,
		additions: DataTypes.STRING,
		date: {
			type: DataTypes.DATE,
		},
		beingExecuted: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
		}
	}, {
		indexes: [
			{
				unique: false,
				fields: ['beingExecuted', 'date']
			}
		]
	});
};
