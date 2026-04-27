using Microsoft.OpenApi;
using Microsoft.EntityFrameworkCore;
using NLog;
using NLog.Config;
using NLog.Extensions.Logging;
using NLog.Targets;
using NLog.Web;


namespace Five68
{
	public class Program
	{
		public static void Main(string[] args)
		{
			WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
			builder.Configuration
				.SetBasePath(AppContext.BaseDirectory)
				.AddJsonFile("appsettings.json", optional: false, reloadOnChange: false)
				.AddEnvironmentVariables();

			InitializeLogger();
			LoadServicesIntoDI(builder.Services, builder.Configuration);

			builder.Services.AddHttpContextAccessor();

			builder.Services.AddEndpointsApiExplorer();
			builder.Services.AddSwaggerGen(c =>
			{
				c.SwaggerDoc("v1", new OpenApiInfo { Title = "568 Platform APIs", Version = "v1" });

				// add Accept Language Header here in case of intl

				// Add security definitions here
			});

			// Configure the HTTP request pipeline
			builder.Services.AddCors(options =>
			{
				options.AddDefaultPolicy(builder =>
				{
					builder.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
				});
			});

			WebApplication app = builder.Build();
			if (app.Environment.IsDevelopment())
			{
				app.UseSwagger();
				app.UseSwaggerUI();
			}
			else
			{
				app.UseHsts();
			}

			app.UseHttpsRedirection();
			app.UseCors();
			// app.UseAuthentication();
			// app.UseAuthorization();
			// app.UseResponseCompression();

			// app.MapControllers();
			app.UseStaticFiles(new StaticFileOptions
			{
				RequestPath = "/static",
			});

			Microsoft.Extensions.Logging.ILogger logger = app.Services.GetRequiredService<ILogger<Program>>();

			app.Run();

			logger.LogCritical("Shutting down");
			NLog.LogManager.Shutdown();
		}

		public static void LoadServicesIntoDI(IServiceCollection services, IConfigurationRoot configuration)
		{
			services.AddDbContext<Five68DbContext>((sp, options) =>
			{
				options.UseNpgsql(configuration.GetConnectionString("DefaultConnection"));
			});

			// Setup Log with NLog
			services.AddLogging(loggingBuilder =>
			{
				loggingBuilder.ClearProviders();
				loggingBuilder.AddNLog(new NLogAspNetCoreOptions() { RemoveLoggerFactoryFilter = false });
			});
		}

		private static void InitializeLogger()
		{
			LoggingConfiguration config = new();
			LogManager.Setup().RegisterNLogWeb();

			ColoredConsoleTarget consoleTarget = new()
			{
				Name = "Console",
				Layout = "${longdate}|${level:uppercase=true}|${logger}|${message}|${exception:format=ToString}",
			};
			config.AddRule(NLog.LogLevel.Trace, NLog.LogLevel.Fatal, consoleTarget, "*");
			LogManager.Configuration = config;
		}
	}
}