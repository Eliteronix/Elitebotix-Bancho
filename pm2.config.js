require('dotenv').config();

module.exports = {
	name: "Elitebotix Bancho", // Name of your application
	script: "index.js", // Entry point of your application
	log_date_format: "YYYY-MM-DD HH:mm:ss",
	// interpreter: "bun", // Bun interpreter
	watch: returnBoolean(process.env.SERVER), // Watch for file changes
	ignore_watch: [
		".git",
		"node_modules",
		"matchLogs",
		"databases",
	],
	env: {
		PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`, // Add "~/.bun/bin/bun" to PATH
	}
};

function returnBoolean(value) {
	if (value === "Live") return false;
	if (value === "Dev") return true;
	return value;
}