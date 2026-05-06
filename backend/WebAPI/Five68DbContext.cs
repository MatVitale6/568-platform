using Microsoft.EntityFrameworkCore;
using Five68.Models;
using Five68.Models.Authentication;

namespace Five68
{
	public class Five68DbContext : DbContext
	{
		public Five68DbContext(DbContextOptions<Five68DbContext> options)
			: base(options)
		{
		}

		public DbSet<User> Users => Set<User>();
		public DbSet<Employee> Employees => Set<Employee>();
		public DbSet<Shift> Shifts => Set<Shift>();
		public DbSet<ShiftAssignment> ShiftAssignments => Set<ShiftAssignment>();
		public DbSet<SwapRequest> SwapRequests => Set<SwapRequest>();
		public DbSet<UserRefreshTokens> RefreshTokens => Set<UserRefreshTokens>();
		protected override void OnModelCreating(ModelBuilder modelBuilder)
		{
			base.OnModelCreating(modelBuilder);

			modelBuilder.Entity<User>(e =>
			{
				e.ToTable("t_users");
				e.HasKey(x => x.Id);
				e.Property(x => x.Id).ValueGeneratedNever();
				e.Property(x => x.Role).HasConversion<string>();
				e.HasIndex(x => x.Email).IsUnique();

				e.HasOne(x => x.Employee)
					.WithOne(x => x.User)
					.HasForeignKey<Employee>(x => x.UserId)
					.OnDelete(DeleteBehavior.Cascade);
			});

			modelBuilder.Entity<Employee>(e =>
			{
				e.ToTable("t_employees");
				e.HasKey(x => x.UserId);
				e.Property(x => x.UserId).ValueGeneratedNever();
				e.HasIndex(x => x.FiscalCode).IsUnique();
			});

			modelBuilder.Entity<Shift>(e =>
			{
				e.ToTable("t_shifts");
				e.HasKey(x => x.Id);
				e.Property(x => x.Id).ValueGeneratedNever();
				e.HasIndex(x => x.WorkDate).IsUnique();

				e.HasOne(x => x.Creator)
					.WithMany()
					.HasForeignKey(x => x.CreatedBy)
					.OnDelete(DeleteBehavior.SetNull);
			});

			modelBuilder.Entity<ShiftAssignment>(e =>
			{
				e.ToTable("t_shift_assignments");
				e.HasKey(x => x.Id);
				e.Property(x => x.Id).ValueGeneratedNever();
				e.HasIndex(x => new { x.ShiftId, x.EmployeeId }).IsUnique();

				e.HasOne(x => x.Shift)
					.WithMany(x => x.Assignments)
					.HasForeignKey(x => x.ShiftId)
					.OnDelete(DeleteBehavior.Cascade);

				e.HasOne(x => x.Employee)
					.WithMany()
					.HasForeignKey(x => x.EmployeeId)
					.OnDelete(DeleteBehavior.Cascade);
			});

			modelBuilder.Entity<SwapRequest>(e =>
			{
				e.ToTable("t_swap_requests");
				e.HasKey(x => x.Id);
				e.Property(x => x.Id).ValueGeneratedNever();
				e.Property(x => x.Status).HasConversion<string>();

				e.HasOne(x => x.Shift)
					.WithMany(x => x.SwapRequests)
					.HasForeignKey(x => x.ShiftId)
					.OnDelete(DeleteBehavior.Cascade);

				e.HasOne(x => x.Requester)
					.WithMany()
					.HasForeignKey(x => x.RequesterId)
					.OnDelete(DeleteBehavior.Cascade);

				e.HasOne(x => x.TargetEmployee)
					.WithMany()
				 	.HasForeignKey(x => x.TargetEmployeeId)
					.OnDelete(DeleteBehavior.Cascade);
			});

			modelBuilder.Entity<UserRefreshTokens>(e =>
			{
				e.ToTable("t_refresh_tokens");
				e.HasKey(x => x.Id);
				e.Property(x => x.Id).ValueGeneratedOnAdd();
				e.HasIndex(x => x.Email);
			});
		}

	}
}