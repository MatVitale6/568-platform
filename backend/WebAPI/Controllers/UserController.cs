using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Components;
using RouteAttribute = Microsoft.AspNetCore.Mvc.RouteAttribute;
using Five68.Services;

namespace Five68.Controllers
{
	[Route("[controller]")]
	[ApiController]
	[Authorize]
	public class UserController : Controller
	{
		private readonly UserService userService_;
		private readonly ILogger logger_;

		public UserController(UserService userService, ILogger<UserController> logger = null)
		{
			userService_ = userService;
			logger_ = logger;
		}



	}
}