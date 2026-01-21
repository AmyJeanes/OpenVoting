using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace OpenVoting.Server.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class FlasherController : ControllerBase
    {
        private readonly Settings _settings;
        private readonly ILogger<FlasherController> _logger;

        public FlasherController(IOptions<Settings> settings, ILogger<FlasherController> logger)
        {
            _settings = settings.Value;
            _logger = logger;
        }

        [HttpGet(Name = "GetFirmware")]
        public ActionResult<Firmware> Get()
        {
            throw new NotImplementedException("Firmware serving not implemented yet.");
        }

        public record Firmware(byte[] FileBytes);
    }
}
