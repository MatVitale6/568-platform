using Five68.Models;
using Five68.Models.Authentication;
using Five68.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
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
			logger_.LogTrace("/login API was called");
			Tokens token = await authService_.Login(userData);

			logger_.LogInformation("User " + userData.Email + " has logged in");

			return Ok(token);
		}

		/// <summary>
		/// Logout the user from the platform, the token will still be valid for the next 5 minutes at most
		/// </summary>
		[Authorize]
		[HttpPost("logout")]
		public async Task<IActionResult> Logout()
		{
			logger_.LogTrace("/logout API was called");
			string? email = User.FindFirst(ClaimTypes.Email)?.Value;
			logger_.LogDebug($"User: {User.ToString()}");
			if (email is null)
				return Unauthorized();

			logger_?.LogInformation($"User {email} required logout");

			await authService_.Logout(email);
			return Ok();
		}
	}
}