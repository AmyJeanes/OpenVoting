using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using OpenVoting.Data;
using OpenVoting.Server;
using OpenVoting.Server.Controllers;
using OpenVoting.Server.Services;
using OpenVoting.Server.Tests.Helpers;
using NUnit.Framework;

namespace OpenVoting.Server.Tests;

public class AssetsControllerTests
{
	[Test]
	public async Task Upload_WithNonImage_ReturnsBadRequest()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var storage = new FakeAssetStorage();
		var controller = BuildController(db, storage);
		controller.ControllerContext = new ControllerContext
		{
			HttpContext = new DefaultHttpContext
			{
				User = TestAuthHelper.CreatePrincipal(Guid.NewGuid(), Guid.NewGuid())
			}
		};

		var file = new FormFile(new MemoryStream(new byte[] { 1, 2, 3 }), 0, 3, "file", "test.txt")
		{
			Headers = new HeaderDictionary(),
			ContentType = "text/plain"
		};

		var actionResult = await controller.Upload(file, CancellationToken.None);

		var badRequest = actionResult.Result as BadRequestObjectResult;
		Assert.That(badRequest, Is.Not.Null);
		Assert.That(badRequest.Value, Is.EqualTo("Only image uploads are supported"));
	}

	[Test]
	public async Task Upload_SavesAssetAndReturnsUrl()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var storage = new FakeAssetStorage();
		var controller = BuildController(db, storage, publicBaseUrl: "https://cdn.example.com");
		controller.ControllerContext = new ControllerContext
		{
			HttpContext = new DefaultHttpContext
			{
				User = TestAuthHelper.CreatePrincipal(Guid.NewGuid(), Guid.NewGuid())
			}
		};

		var file = new FormFile(new MemoryStream(new byte[] { 1, 2, 3, 4 }), 0, 4, "file", "image.png")
		{
			Headers = new HeaderDictionary(),
			ContentType = "image/png"
		};

		var actionResult = await controller.Upload(file, CancellationToken.None);

		var ok = actionResult.Result as OkObjectResult;
		Assert.That(ok, Is.Not.Null);
		var response = ok!.Value as AssetResponse;
		Assert.That(response, Is.Not.Null);
		Assert.That(response!.Url, Does.StartWith("https://cdn.example.com/"));
		Assert.That(await db.Assets.CountAsync(), Is.EqualTo(1));
	}

	private static AssetsController BuildController(ApplicationDbContext db, IAssetStorage storage, string? publicBaseUrl = null)
	{
		var settings = Options.Create(new Settings
		{
			BlobStorage = new BlobStorageSettings
			{
				ConnectionString = "UseDevelopmentStorage=true",
				PublicBaseUrl = publicBaseUrl
			}
		});

		return new AssetsController(db, storage, settings);
	}
}
