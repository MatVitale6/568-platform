using Microsoft.EntityFrameworkCore;
using Five68.Model;

namespace Five68
{
	public class Five68DbContext : DbContext
	{
		public Five68DbContext(DbContextOptions<Five68DbContext> options)
			: base(options)
		{
		}

		public DbSet<Profile> Profiles => Set<Profile>();
		public DbSet<Employee> Employees => Set<Employee>();
		public DbSet<Shift> Shifts => Set<Shift>();
		public DbSet<ShiftAssignment> ShiftAssignments => Set<ShiftAssignment>();
		public DbSet<SwapRequest> SwapRequests => Set<SwapRequest>();
		protected override void OnModelCreating(ModelBuilder modelBuilder)
		{
			base.OnModelCreating(modelBuilder);

			modelBuilder.Entity<Profile>(e =>
			{
				e.ToTable("profile");
				e.HasKey(x => x.Id);
				e.Property(x => x.Id).ValueGeneratedNever();
				e.Property(x => x.Role).HasConversion<string>();
				e.HasIndex(x => x.Email).IsUnique();

				e.HasOne(x => x.Employee)
					.WithOne(x => x.Profile)
					.HasForeignKey<Employee>(x => x.ProfileId)
					.OnDelete(DeleteBehavior.Cascade);
			});

			modelBuilder.Entity<Employee>(e =>
			{
				e.ToTable("employee");
				e.HasKey(x => x.ProfileId);
				e.Property(x => x.ProfileId).ValueGeneratedNever();
				e.HasIndex(x => x.FiscalCode).IsUnique();
			});

			modelBuilder.Entity<Shift>(e =>
			{
				e.ToTable("shift");
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
				e.ToTable("shift_assignment");
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
				e.ToTable("swap_request");
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
		}

	}
}