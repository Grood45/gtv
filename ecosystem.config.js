module.exports = {
    apps: [
        {
            name: "fullgivecan-api",
            script: "./server.js",
            instances: -1, // Use all CPU cores EXCEPT one (Safe for shared servers)
            exec_mode: "cluster", // Enable load balancing
            watch: false, // Don't watch files in production (use specialized tools or CI/CD)
            max_memory_restart: "500M", // Auto-restart if memory leaks
            env: {
                NODE_ENV: "production",
            },
            log_date_format: "YYYY-MM-DD HH:mm Z",
            error_file: "./logs/err.log",
            out_file: "./logs/out.log",
            merge_logs: true,
        },
    ],
};
