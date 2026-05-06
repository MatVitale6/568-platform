using System.IO;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System;
using Five68;
using Five68.Models;

namespace Five68.Initializer
{
	internal class Program
	{
		static void Main(string[] args)
		{
			AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
			Console.WriteLine("Hello, World!");
			Console.WriteLine("USE THIS PROJECT IN TESTING ENVIRONMENT ONLY");

			// 1. Setup Configuration
			var configuration = new ConfigurationBuilder()
				.SetBasePath(AppContext.BaseDirectory)
				.AddJsonFile("appsettings.Development.json", optional: false)
				.Build();

			// 2. Setup DI & DbContext
			var services = new ServiceCollection();

			services.AddDbContext<Five68DbContext>(options =>
			{
				options.UseNpgsql(configuration.GetConnectionString("DefaultConnection"));
			});

			var serviceProvider = services.BuildServiceProvider();

			// 3. Run Seeding
			using (var scope = serviceProvider.CreateScope())
			{
				var db = scope.ServiceProvider.GetRequiredService<Five68DbContext>();
				db.Database.EnsureDeleted();
				db.Database.EnsureCreated();
				Console.WriteLine("Database created. Seeding data...");

				SeedData(db);
			}

			Console.WriteLine("Seeding complete.");
		}

		private static void SeedData(Five68DbContext db)
		{
			// Prevent duplicate seeding
			if (db.Users.Any())
			{
				Console.WriteLine("Database already contains data. Skipping seed.");
				return;
			}

			// --- 1. PROFILES & EMPLOYEES ---
			// Since Employee depends on Profile, we create them together.
			// We must manually set IDs because of ValueGeneratedNever()

			var admin = new User
			{
				Id = Guid.NewGuid(),
				FullName = "Admin Admin",
				Email = "admin@five68.com",
				Role = UserRole.Admin // Assuming an Enum named Role
			};

			var manager = new User
			{
				Id = Guid.NewGuid(),
				FullName = "Managers",
				Email = "manager@five68.com",
				Role = UserRole.Manager
			};

			var mario = new User
			{
				Id = Guid.NewGuid(),
				FullName = "Mario Rossi",
				Email = "mario@five68.com",
				Role = UserRole.Employee
			};

			var luigi = new User
			{
				Id = Guid.NewGuid(),
				FullName = "Luigi Rossi",
				Email = "luigi@five68.com",
				Role = UserRole.Employee
			};

			db.Users.AddRange(admin, manager, mario, luigi);

			// Create Employees linked to Users via UserId
			var adminEmployee = new Employee
			{
				UserId = admin.Id, // PK & FK
				FiscalCode = "ADM001"
			};

			var managerEmployee = new Employee
			{
				UserId = manager.Id,
				FiscalCode = "MGR002"
			};

			var marioEmployee = new Employee
			{
				UserId = mario.Id,
				FiscalCode = "MROSSI80A01H501Z"
			};

			var luigiEmployee = new Employee
			{
				UserId = luigi.Id,
				FiscalCode = "LVERDI90B02H501Z"
			};

			db.Employees.AddRange(adminEmployee, managerEmployee, marioEmployee, luigiEmployee);


			// --- 2. SHIFTS ---
			// Shifts need a Creator (Profile)

			var todayShift = new Shift
			{
				Id = Guid.NewGuid(),
				WorkDate = DateTime.UtcNow.Date,
				CreatedBy = manager.Id // Links to Creator
			};

			var tomorrowShift = new Shift
			{
				Id = Guid.NewGuid(),
				WorkDate = DateTime.UtcNow.Date.AddDays(1),
				CreatedBy = manager.Id
			};

			var yesterdayShift = new Shift
			{
				Id = Guid.NewGuid(),
				WorkDate = DateTime.UtcNow.Date.AddDays(-1),
				CreatedBy = admin.Id
			};

			db.Shifts.AddRange(todayShift, tomorrowShift, yesterdayShift);


			// --- 3. SHIFT ASSIGNMENTS ---
			// Assign Employees to Shifts

			var assignment1 = new ShiftAssignment
			{
				Id = Guid.NewGuid(),
				ShiftId = todayShift.Id,
				EmployeeId = marioEmployee.UserId
			};

			var assignment2 = new ShiftAssignment
			{
				Id = Guid.NewGuid(),
				ShiftId = tomorrowShift.Id,
				EmployeeId = luigiEmployee.UserId
			};

			// Manager is also working tomorrow
			var assignment3 = new ShiftAssignment
			{
				Id = Guid.NewGuid(),
				ShiftId = tomorrowShift.Id,
				EmployeeId = managerEmployee.UserId
			};

			db.ShiftAssignments.AddRange(assignment1, assignment2, assignment3);


			// --- 4. SWAP REQUESTS ---
			// Mario wants to swap his shift today with Luigi

			var swapRequest = new SwapRequest
			{
				Id = Guid.NewGuid(),
				ShiftId = todayShift.Id,          // The shift being swapped
				RequesterId = marioEmployee.UserId, // Mario asks
				TargetEmployeeId = luigiEmployee.UserId, // Luigi is the target
				Status = SwapRequestStatus.Pending
			};

			db.SwapRequests.Add(swapRequest);

			// Commit all changes to the database
			db.SaveChanges();
		}
	}
}