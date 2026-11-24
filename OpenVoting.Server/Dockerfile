# See https://aka.ms/customizecontainer to learn how to customize your debug container and how Visual Studio uses this Dockerfile to build your images for faster debugging.

# This stage is used when running from VS in fast mode (Default for Debug configuration)
FROM mcr.microsoft.com/dotnet/aspnet:11.0@sha256:ca396ece3f2a2e62c7a03f1d7d710b8bc7e8c9dea5597d091178d9f5bfca13f0 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080
EXPOSE 8081


# This stage is used to build the service project
FROM mcr.microsoft.com/dotnet/sdk:11.0@sha256:2794448a07118a6eaf00f29ab5d2bf44928517ce5ff86505a63a69230374f599 AS with-deps
RUN apt-get update
RUN apt-get install curl -y
RUN curl -sL https://deb.nodesource.com/setup_26.x | bash
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
ARG TARGETARCH
# Publishing for one architecture keeps only that platform's SkiaSharp native library instead of every RID's
RUN dotnet publish "./OpenVoting.Server.csproj" -c $BUILD_CONFIGURATION -a $TARGETARCH --self-contained false -o /app/publish /p:UseAppHost=false

# This stage is used in production or when running from VS in regular mode (Default when not using the Debug configuration)
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "OpenVoting.Server.dll"]
