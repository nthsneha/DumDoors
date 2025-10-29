# DumDoors Production Deployment Guide

This guide covers production deployment, configuration, monitoring, and maintenance of the DumDoors game system.

## Prerequisites

- Docker (version 20.10+) and Docker Compose (version 2.0+)
- SSL certificates for HTTPS
- Domain name configured
- AWS CLI (optional, for S3 backups)
- Sufficient server resources (see Resource Requirements)

## Resource Requirements

### Minimum Production Setup
- **CPU**: 4 cores
- **RAM**: 8GB
- **Storage**: 50GB SSD
- **Network**: 100Mbps

### Recommended Production Setup
- **CPU**: 8 cores
- **RAM**: 16GB
- **Storage**: 100GB SSD
- **Network**: 1Gbps

## Quick Production Deployment

1. **Clone and configure:**
   ```bash
   git clone <repository-url>
   cd dumdoors
   chmod +x scripts/*.sh
   ```

2. **Configure production environment:**
   ```bash
   cp .env.production .env
   # Edit .env with your production values
   ```

3. **Set up SSL certificates:**
   ```bash
   mkdir -p config/nginx/ssl
   # Copy your SSL certificate and key files
   cp your-cert.pem config/nginx/ssl/cert.pem
   cp your-key.pem config/nginx/ssl/key.pem
   ```

4. **Deploy:**
   ```bash
   ./scripts/deploy.sh production
   ```

## Configuration

### Environment Variables

Critical production environment variables in `.env`:

```bash
# Security - CHANGE ALL PASSWORDS
MONGO_ROOT_PASSWORD=secure_random_password_here
NEO4J_PASSWORD=secure_random_password_here
REDIS_PASSWORD=secure_random_password_here
JWT_SECRET=secure_random_string_at_least_32_characters
GRAFANA_ADMIN_PASSWORD=secure_admin_password

# AI Service Keys
OPENAI_API_KEY=your_production_openai_key
ANTHROPIC_API_KEY=your_production_anthropic_key

# Backup Configuration
BACKUP_S3_BUCKET=your-backup-bucket
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
```

### SSL Configuration

Place your SSL certificates in `config/nginx/ssl/`:
- `cert.pem`: SSL certificate
- `key.pem`: Private key

Update `config/nginx/nginx.conf` with your domain name:
```nginx
server_name your-domain.com;
```

### Database Configuration

#### MongoDB Production Settings
- Authentication enabled
- Replica set recommended for high availability
- Regular backups configured
- Monitoring enabled

#### Neo4j Production Settings
- Authentication enabled
- Memory settings optimized for workload
- Query logging enabled
- APOC procedures available

#### Redis Production Settings
- Password authentication
- Persistence enabled (AOF + RDB)
- Memory limits configured
- Monitoring enabled

## Deployment

### Initial Deployment

```bash
# Deploy to production
./scripts/deploy.sh production

# Deploy with monitoring
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile monitoring up -d

# Deploy with reverse proxy
docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile proxy up -d
```

### Rolling Updates

```bash
# Pull latest changes
git pull origin main

# Deploy with automatic backup
BACKUP_BEFORE_DEPLOY=true ./scripts/deploy.sh production
```

### Scaling Services

```bash
# Scale backend services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale backend=3

# Scale AI services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale ai-service=2
```

## Monitoring

### Health Checks

```bash
# Manual health check
./scripts/health-check.sh

# Continuous monitoring
watch -n 30 './scripts/health-check.sh'
```

### Service Monitoring

Access monitoring dashboards:
- **Prometheus**: http://your-domain:9090
- **Grafana**: http://your-domain:3000 (admin/your-password)

### Log Monitoring

```bash
# View all logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# View specific service logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend
```

### Key Metrics to Monitor

1. **Application Metrics**
   - Response times
   - Error rates
   - Active game sessions
   - WebSocket connections

2. **Database Metrics**
   - Connection counts
   - Query performance
   - Storage usage
   - Replication lag

3. **System Metrics**
   - CPU usage
   - Memory usage
   - Disk I/O
   - Network traffic

## Backup and Recovery

### Automated Backups

Set up automated backups with cron:
```bash
# Add to crontab
0 2 * * * /path/to/dumdoors/scripts/backup.sh
```

### Manual Backup

```bash
./scripts/backup.sh
```

### Restore from Backup

```bash
# List available backups
ls -la /backups/

# Restore from specific timestamp
./scripts/restore.sh 20241027_020000
```

### S3 Backup Configuration

Configure AWS S3 for off-site backups:
```bash
# Install AWS CLI
pip install awscli

# Configure AWS credentials
aws configure

# Test S3 access
aws s3 ls s3://your-backup-bucket/
```

## Security

### Network Security
- All services run in isolated Docker network
- Only necessary ports exposed
- Rate limiting configured in Nginx
- SSL/TLS encryption for all external traffic

### Application Security
- JWT tokens for authentication
- Input validation and sanitization
- SQL injection prevention
- XSS protection headers

### Database Security
- Authentication required for all databases
- Network isolation
- Regular security updates
- Encrypted connections

### Secrets Management
- Environment variables for sensitive data
- No secrets in code or images
- Regular password rotation
- Secure backup encryption

## Troubleshooting

### Common Issues

1. **Service Won't Start**
   ```bash
   # Check logs
   docker-compose logs service-name
   
   # Check resource usage
   docker stats
   
   # Restart service
   docker-compose restart service-name
   ```

2. **Database Connection Issues**
   ```bash
   # Check database health
   ./scripts/health-check.sh
   
   # Restart databases
   docker-compose restart mongodb neo4j redis
   ```

3. **High Memory Usage**
   ```bash
   # Check memory usage
   docker stats
   
   # Adjust memory limits in docker-compose.prod.yml
   # Restart services
   ```

4. **SSL Certificate Issues**
   ```bash
   # Check certificate validity
   openssl x509 -in config/nginx/ssl/cert.pem -text -noout
   
   # Test SSL configuration
   curl -I https://your-domain.com
   ```

### Performance Optimization

1. **Database Optimization**
   - Monitor slow queries
   - Optimize indexes
   - Adjust memory settings
   - Consider read replicas

2. **Application Optimization**
   - Monitor response times
   - Optimize API endpoints
   - Implement caching
   - Scale horizontally

3. **Infrastructure Optimization**
   - Monitor resource usage
   - Optimize Docker images
   - Use SSD storage
   - Implement CDN

## Maintenance

### Regular Maintenance Tasks

1. **Daily**
   - Check service health
   - Monitor error logs
   - Verify backups

2. **Weekly**
   - Review performance metrics
   - Check disk space
   - Update security patches

3. **Monthly**
   - Review and rotate logs
   - Update dependencies
   - Test disaster recovery

### Updates and Patches

```bash
# Update system packages
sudo apt update && sudo apt upgrade

# Update Docker images
docker-compose pull

# Deploy updates
./scripts/deploy.sh production
```

### Log Rotation

Configure log rotation to prevent disk space issues:
```bash
# Add to /etc/logrotate.d/dumdoors
/var/lib/docker/containers/*/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
```

## Disaster Recovery

### Recovery Procedures

1. **Complete System Failure**
   - Restore from latest backup
   - Verify data integrity
   - Test all services
   - Update DNS if needed

2. **Database Corruption**
   - Stop affected services
   - Restore database from backup
   - Verify data consistency
   - Restart services

3. **Security Breach**
   - Isolate affected systems
   - Change all passwords
   - Review access logs
   - Update security measures

### Recovery Testing

Regularly test recovery procedures:
```bash
# Test backup restoration in staging environment
./scripts/restore.sh latest_backup_timestamp

# Verify data integrity
./scripts/health-check.sh
```

## Support and Monitoring

### Alerting

Set up alerts for:
- Service downtime
- High error rates
- Resource exhaustion
- Security events

### Contact Information

Maintain emergency contact information for:
- System administrators
- Database administrators
- Security team
- Hosting provider support

### Documentation

Keep updated documentation for:
- System architecture
- Deployment procedures
- Recovery procedures
- Contact information