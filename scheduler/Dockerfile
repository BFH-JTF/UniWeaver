# ── Build stage ──────────────────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /build

COPY pom.xml .
# Pre-download dependencies so later source changes only invalidate the
# compile layer, not the dependency layer.
RUN mvn -q dependency:go-offline || true

COPY src ./src
RUN mvn -q package -DskipTests

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=builder /build/target/app.jar /app/app.jar

EXPOSE 8081

CMD ["java", "-jar", "/app/app.jar"]