using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using OpenVoting.Data;
using OpenVoting.Server;
using OpenVoting.Server.Controllers;
using OpenVoting.Data.Enums;
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

	[Test]
	public async Task Get_OriginalAssetBeforeVoting_ReturnsForbidden()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var submitterId = Guid.NewGuid();
		var viewerId = Guid.NewGuid();

		var poll = new Poll
		{
			Id = Guid.NewGuid(),
			CommunityId = communityId,
			Status = PollStatus.Review,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddDays(-2),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddDays(-1),
			VotingOpensAt = DateTimeOffset.UtcNow.AddHours(1),
			VotingClosesAt = DateTimeOffset.UtcNow.AddHours(2)
		};

		var original = new Asset { Id = Guid.NewGuid(), StorageKey = "assets/original.png", ContentType = "image/png", Bytes = 10 };

		db.Polls.Add(poll);
		db.Assets.Add(original);
		db.PollEntries.Add(new PollEntry
		{
			Id = Guid.NewGuid(),
			PollId = poll.Id,
			SubmittedByMemberId = submitterId,
			OriginalAssetId = original.Id,
			CreatedAt = DateTimeOffset.UtcNow
		});
		await db.SaveChangesAsync();

		var controller = BuildController(db, new FakeAssetStorage());
		controller.ControllerContext = new ControllerContext
		{
			HttpContext = new DefaultHttpContext
			{
				User = TestAuthHelper.CreatePrincipal(viewerId, communityId)
			}
		};

		var result = await controller.Get(original.Id, CancellationToken.None);
		var problem = result.Result as ObjectResult;
		Assert.That(problem, Is.Not.Null);
		Assert.That(problem!.StatusCode, Is.EqualTo(StatusCodes.Status403Forbidden));
	}

	[Test]
	public async Task Get_PublicAssetBeforeVoting_AllowsAccess()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var memberId = Guid.NewGuid();

		var poll = new Poll
		{
			Id = Guid.NewGuid(),
			CommunityId = communityId,
			Status = PollStatus.Review,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddDays(-2),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddDays(-1),
			VotingOpensAt = DateTimeOffset.UtcNow.AddHours(1),
			VotingClosesAt = DateTimeOffset.UtcNow.AddHours(2)
		};

		var publicAsset = new Asset { Id = Guid.NewGuid(), StorageKey = "assets/public.png", ContentType = "image/png", Bytes = 8 };

		db.Polls.Add(poll);
		db.Assets.Add(publicAsset);
		db.PollEntries.Add(new PollEntry
		{
			Id = Guid.NewGuid(),
			PollId = poll.Id,
			SubmittedByMemberId = memberId,
			PublicAssetId = publicAsset.Id,
			CreatedAt = DateTimeOffset.UtcNow
		});
		await db.SaveChangesAsync();

		var controller = BuildController(db, new FakeAssetStorage());
		controller.ControllerContext = new ControllerContext
		{
			HttpContext = new DefaultHttpContext
			{
				User = TestAuthHelper.CreatePrincipal(memberId, communityId)
			}
		};

		var result = await controller.Get(publicAsset.Id, CancellationToken.None);
		var ok = result.Result as OkObjectResult;
		Assert.That(ok, Is.Not.Null);
		var response = ok!.Value as AssetResponse;
		Assert.That(response, Is.Not.Null);
		Assert.That(response!.Id, Is.EqualTo(publicAsset.Id));
	}

	[Test]
	public async Task Get_OriginalAssetBeforeVoting_AllowsOwner()
	{
		await using var db = TestDbContextFactory.CreateContext();
		var communityId = Guid.NewGuid();
		var memberId = Guid.NewGuid();

		var poll = new Poll
		{
			Id = Guid.NewGuid(),
			CommunityId = communityId,
			Status = PollStatus.Review,
			SubmissionOpensAt = DateTimeOffset.UtcNow.AddDays(-2),
			SubmissionClosesAt = DateTimeOffset.UtcNow.AddDays(-1),
			VotingOpensAt = DateTimeOffset.UtcNow.AddHours(1),
			VotingClosesAt = DateTimeOffset.UtcNow.AddHours(2)
		};

		var original = new Asset { Id = Guid.NewGuid(), StorageKey = "assets/original.png", ContentType = "image/png", Bytes = 10 };

		db.Polls.Add(poll);
		db.Assets.Add(original);
		db.PollEntries.Add(new PollEntry
		{
			Id = Guid.NewGuid(),
			PollId = poll.Id,
			SubmittedByMemberId = memberId,
			OriginalAssetId = original.Id,
			CreatedAt = DateTimeOffset.UtcNow
		});
		await db.SaveChangesAsync();

		var controller = BuildController(db, new FakeAssetStorage());
		controller.ControllerContext = new ControllerContext
		{
			HttpContext = new DefaultHttpContext
			{
				User = TestAuthHelper.CreatePrincipal(memberId, communityId)
			}
		};

		var result = await controller.Get(original.Id, CancellationToken.None);
		var ok = result.Result as OkObjectResult;
		Assert.That(ok, Is.Not.Null);
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
