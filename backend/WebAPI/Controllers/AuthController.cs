using Five68.Models;
using Five68.Models.Authentication;
using Five68.Services;
using Microsoft.AspNetCore.Mvc;
using RouteAttribute = Microsoft.AspNetCore.Mvc.RouteAttribute;

namespace Five68.Controllers
{
	[Route("[controller]")]
	[ApiController]
	public class AuthController : ControllerBase
	{
		private readonly AuthService authService_;
		private readonly ILogger logger_;

		public AuthController(AuthService authService, ILogger<AuthController> logger = null)
		{
			authService_ = authService;
			logger_ = logger;
		}

		[HttpPost("login")]
		public async Task<IActionResult> Login(UserLogin userData)
		{
			Tokens token = await authService_.Login(userData);

			logger_.LogInformation("User " + userData.Email + " has logged in");

			return Ok(token);
		}
	}
}