using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace OpenVoting.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PlaceholderController : ControllerBase
    {
        private readonly Settings _settings;
        private readonly ILogger<PlaceholderController> _logger;

        public PlaceholderController(IOptions<Settings> settings, ILogger<PlaceholderController> logger)
        {
            _settings = settings.Value;
            _logger = logger;
        }

        [HttpGet]
        public ActionResult Get()
        {
            throw new NotImplementedException("Not implemented yet");
        }
    }
}
