# Stage 1: Build stage
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Copy the entire project context
COPY . .

# Build the shared library and the service
RUN mvn clean package -pl logicore-shared,inbound-yard-service -DskipTests -B

# Stage 2: Run stage with optimized Alpine JRE image
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/inbound-yard-service/target/*.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java", "-Xms64m", "-Xmx128m", "-jar", "app.jar"]
