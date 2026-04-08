module.exports = {
    apps: [
        {
            name: "glivestreeming",
            script: "./server.js",
            instances: 1, // Stable single instance
            exec_mode: "fork", // Use fork mode for single instance stability
            watch: false,
            max_memory_restart: "1G",
            node_args: "--max-old-space-size=1024", // Give Node.js 1GB Heap
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
