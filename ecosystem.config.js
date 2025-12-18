module.exports = {
  apps: [{
    name: 'noty-backend',
    script: 'server.js',
    cwd: '/var/www/noty',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/var/www/noty/logs/pm2-error.log',
    out_file: '/var/www/noty/logs/pm2-out.log',
    log_file: '/var/www/noty/logs/pm2-combined.log',
    time: true,
    watch: false,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
