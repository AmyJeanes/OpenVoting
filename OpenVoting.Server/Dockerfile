# See https://aka.ms/customizecontainer to learn how to customize your debug container and how Visual Studio uses this Dockerfile to build your images for faster debugging.

# This stage is used when running from VS in fast mode (Default for Debug configuration)
FROM mcr.microsoft.com/dotnet/aspnet:10.0@sha256:57460add89e2b3dd1950c41d8b7dc96eeb7a24d13d98e3656ce9997a8b746bd6 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080
EXPOSE 8081


# This stage is used to build the service project
FROM mcr.microsoft.com/dotnet/sdk:10.0@sha256:83e0db97c45d2e39b80123fe42940a23c423405a17f80b608a4b8768033d6392 AS with-deps
RUN apt-get update
RUN apt-get install curl -y
RUN curl -sL https://deb.nodesource.com/setup_20.x | bash
RUN apt-get -y install nodejs

FROM with-deps AS build
ARG BUILD_CONFIGURATION=Release
ENV DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1 \
    DOTNET_GENERATE_ASPNET_CERTIFICATE=false
WORKDIR /src
COPY ["OpenVoting.Server/OpenVoting.Server.csproj", "OpenVoting.Server/"]
COPY ["OpenVoting.Client/OpenVoting.Client.esproj", "OpenVoting.Client/"]
RUN dotnet restore "./OpenVoting.Server/OpenVoting.Server.csproj"
COPY . .
WORKDIR "/src/OpenVoting.Server"
RUN dotnet build "./OpenVoting.Server.csproj" -c $BUILD_CONFIGURATION -o /app/build

# This stage is used to publish the service project to be copied to the final stage
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./OpenVoting.Server.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

# This stage is used in production or when running from VS in regular mode (Default when not using the Debug configuration)
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "OpenVoting.Server.dll"]
