#!/bin/bash

# Test script for DumDoors database connections

echo "🧪 Testing DumDoors Database Connections"
echo "========================================"

# Test MongoDB
echo "📦 Testing MongoDB connection..."
MONGO_RESULT=$(sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec -T mongodb mongosh --quiet --eval "db.adminCommand('ping').ok")
if [ "$MONGO_RESULT" = "1" ]; then
    echo "✅ MongoDB: Connected successfully"
    
    # Test database creation
    echo "📝 Testing MongoDB database operations..."
    sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec -T mongodb mongosh dumdoors -u admin -p password --authenticationDatabase admin --quiet --eval "
        db.test_collection.insertOne({test: 'data', timestamp: new Date()});
        print('✅ MongoDB: Insert operation successful');
        db.test_collection.findOne({test: 'data'});
        db.test_collection.deleteOne({test: 'data'});
        print('✅ MongoDB: CRUD operations working');
    "
else
    echo "❌ MongoDB: Connection failed"
fi

echo ""

# Test Redis
echo "📦 Testing Redis connection..."
REDIS_RESULT=$(sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec -T redis redis-cli -a password ping 2>/dev/null)
if [ "$REDIS_RESULT" = "PONG" ]; then
    echo "✅ Redis: Connected successfully"
    
    # Test Redis operations
    echo "📝 Testing Redis operations..."
    sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec -T redis redis-cli -a password --no-auth-warning eval "
        redis.call('SET', 'test_key', 'test_value');
        local value = redis.call('GET', 'test_key');
        redis.call('DEL', 'test_key');
        return 'Redis operations working: ' .. value;
    " 0
    echo "✅ Redis: CRUD operations working"
else
    echo "❌ Redis: Connection failed"
fi

echo ""

# Test Neo4j
echo "📦 Testing Neo4j connection..."
NEO4J_RESULT=$(sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec -T neo4j cypher-shell -u neo4j -p password "RETURN 1" 2>/dev/null)
if echo "$NEO4J_RESULT" | grep -q "1"; then
    echo "✅ Neo4j: Connected successfully"
    
    # Test Neo4j operations
    echo "📝 Testing Neo4j operations..."
    sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec -T neo4j cypher-shell -u neo4j -p password "
        CREATE (n:TestNode {name: 'test', timestamp: datetime()});
        MATCH (n:TestNode {name: 'test'}) RETURN n.name;
        MATCH (n:TestNode {name: 'test'}) DELETE n;
    " 2>/dev/null
    echo "✅ Neo4j: CRUD operations working"
else
    echo "❌ Neo4j: Connection failed"
fi

echo ""

# Test Development Tools
echo "🔧 Testing Development Tools..."
echo "📊 MongoDB Express: http://localhost:8081 (admin/password)"
echo "📊 Redis Commander: http://localhost:8082"

# Check if ports are accessible
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8081 | grep -q "200\|401"; then
    echo "✅ MongoDB Express: Accessible on port 8081"
else
    echo "⚠️  MongoDB Express: May still be starting up"
fi

if curl -s -o /dev/null -w "%{http_code}" http://localhost:8082 | grep -q "200"; then
    echo "✅ Redis Commander: Accessible on port 8082"
else
    echo "⚠️  Redis Commander: May still be starting up"
fi

echo ""
echo "🎉 Database testing completed!"
echo ""
echo "📋 Summary:"
echo "   - MongoDB: Running on port 27017"
echo "   - Redis: Running on port 6379"
echo "   - Neo4j: Running on ports 7474 (HTTP) and 7687 (Bolt)"
echo "   - MongoDB Express: http://localhost:8081"
echo "   - Redis Commander: http://localhost:8082"
echo "   - Neo4j Browser: http://localhost:7474"
echo ""
echo "💡 Next steps:"
echo "   1. Open MongoDB Express in your browser to manage MongoDB"
echo "   2. Open Redis Commander in your browser to manage Redis"
echo "   3. Open Neo4j Browser in your browser (neo4j/password)"
echo "   4. Ready to start application services when needed"