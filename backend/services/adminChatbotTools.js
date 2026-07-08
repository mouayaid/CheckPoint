const fs = require("fs");
const path = require("path");
const sql = require("mssql");

const REQUEST_STATUS = Object.freeze({
  pending: 1,
  approved: 2,
  rejected: 3,
});

const RESERVATION_STATUS = Object.freeze({
  active: 1,
  cancelled: 2,
  completed: 3,
  inProgress: 5,
});

let poolPromise;

function getConnectionString() {
  if (process.env.DB_CONNECTION_STRING) {
    return process.env.DB_CONNECTION_STRING;
  }

  if (process.env.ConnectionStrings__DefaultConnection) {
    return process.env.ConnectionStrings__DefaultConnection;
  }

  const appSettingsPath = path.join(
    __dirname,
    "..",
    "PFE.API",
    "appsettings.json",
  );
  const appSettings = JSON.parse(fs.readFileSync(appSettingsPath, "utf8"));

  return appSettings.ConnectionStrings?.DefaultConnection;
}

async function getPool() {
  if (!poolPromise) {
    const connectionString = getConnectionString();

    if (!connectionString) {
      throw new Error("Default database connection string was not found.");
    }

    poolPromise = sql.connect(connectionString);
  }

  return poolPromise;
}

function ensureSelectOnly(query) {
  const normalized = query
    .trim()
    .replace(/^\uFEFF/, "")
    .toUpperCase();

  if (!normalized.startsWith("SELECT") && !normalized.startsWith("WITH")) {
    throw new Error("Admin chatbot database tools only allow SELECT queries.");
  }

  const forbiddenKeywords =
    /\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|GRANT|REVOKE)\b/i;
  if (forbiddenKeywords.test(query)) {
    throw new Error("Unsafe SQL keyword detected.");
  }
}

async function runSelect(query) {
  ensureSelectOnly(query);

  const pool = await getPool();
  const result = await pool.request().query(query);

  return result.recordset;
}

async function getDatabaseSchema() {
  const query = `
    SELECT
      TABLE_NAME AS tableName,
      COLUMN_NAME AS columnName,
      DATA_TYPE AS dataType
    FROM INFORMATION_SCHEMA.COLUMNS
    ORDER BY TABLE_NAME, ORDINAL_POSITION;
  `;

  const rows = await runSelect(query);

  const blockedColumns = [
    "Password",
    "PasswordHash",
    "Token",
    "RefreshToken",
    "ResetToken",
  ];

  return rows.filter(
    (row) =>
      !blockedColumns.some((column) =>
        row.columnName?.toLowerCase().includes(column.toLowerCase()),
      ),
  );
}

async function runSafeSelectQuery({ query }) {
  if (!query || typeof query !== "string") {
    throw new Error("Query is required.");
  }

  ensureSelectOnly(query);

  const forbiddenColumns =
    /\b(Password|PasswordHash|Token|RefreshToken|ResetToken)\b/i;

  if (forbiddenColumns.test(query)) {
    throw new Error("Sensitive columns are not allowed.");
  }

  let safeQuery = query.trim();

  if (!/TOP\s+\(\d+\)|TOP\s+\d+/i.test(safeQuery)) {
    safeQuery = safeQuery.replace(/^SELECT/i, "SELECT TOP (100)");
  }

  return runSelect(safeQuery);
}

async function getPendingRequests() {
  const query = `
    SELECT TOP (100)
      'LeaveRequest' AS requestType,
      lr.Id AS requestId,
      u.FullName AS requesterName,
      u.Email AS requesterEmail,
      d.Name AS departmentName,
      CAST(lr.Type AS nvarchar(50)) AS category,
      lr.Reason AS title,
      lr.CreatedAt AS createdAt,
      'Pending' AS status
    FROM LeaveRequests lr
    INNER JOIN Users u ON u.Id = lr.UserId
    INNER JOIN Departments d ON d.Id = u.DepartmentId
    WHERE lr.Status = ${REQUEST_STATUS.pending}

    UNION ALL

    SELECT TOP (100)
      'GeneralRequest' AS requestType,
      gr.Id AS requestId,
      u.FullName AS requesterName,
      u.Email AS requesterEmail,
      d.Name AS departmentName,
      CAST(gr.Category AS nvarchar(50)) AS category,
      gr.Title AS title,
      gr.CreatedAt AS createdAt,
      'Pending' AS status
    FROM GeneralRequests gr
    INNER JOIN Users u ON u.Id = gr.UserId
    INNER JOIN Departments d ON d.Id = u.DepartmentId
    WHERE gr.Status = ${REQUEST_STATUS.pending}

    UNION ALL

    SELECT TOP (100)
      'UserRegistration' AS requestType,
      u.Id AS requestId,
      u.FullName AS requesterName,
      u.Email AS requesterEmail,
      d.Name AS departmentName,
      ro.Name AS category,
      'Account approval' AS title,
      u.CreatedAt AS createdAt,
      'Pending' AS status
    FROM Users u
    INNER JOIN Departments d ON d.Id = u.DepartmentId
    INNER JOIN Roles ro ON ro.Id = u.RoleId
    WHERE u.IsActive = 0 AND u.RejectedAt IS NULL

    ORDER BY createdAt DESC;
  `;

  return runSelect(query);
}

async function getRequestStats() {
  const query = `
    SELECT requestType, status, COUNT(*) AS count
    FROM (
      SELECT 'LeaveRequest' AS requestType,
        CASE Status
          WHEN ${REQUEST_STATUS.pending} THEN 'Pending'
          WHEN ${REQUEST_STATUS.approved} THEN 'Approved'
          WHEN ${REQUEST_STATUS.rejected} THEN 'Rejected'
          ELSE 'Other'
        END AS status
      FROM LeaveRequests

      UNION ALL

      SELECT 'GeneralRequest' AS requestType,
        CASE Status
          WHEN ${REQUEST_STATUS.pending} THEN 'Pending'
          WHEN ${REQUEST_STATUS.approved} THEN 'Approved'
          WHEN ${REQUEST_STATUS.rejected} THEN 'Rejected'
          ELSE 'Other'
        END AS status
      FROM GeneralRequests

      UNION ALL

      SELECT 'RoomReservation' AS requestType,
        CASE
          WHEN Status = ${RESERVATION_STATUS.active} THEN 'Active'
          WHEN Status = ${RESERVATION_STATUS.inProgress} THEN 'InProgress'
          WHEN Status = ${RESERVATION_STATUS.completed} THEN 'Completed'
          WHEN Status = ${RESERVATION_STATUS.cancelled} THEN 'Cancelled'
          ELSE 'Other'
        END AS status
      FROM RoomReservations

      UNION ALL

      SELECT 'UserRegistration' AS requestType,
        CASE
          WHEN IsActive = 1 THEN 'Approved'
          WHEN RejectedAt IS NOT NULL THEN 'Rejected'
          ELSE 'Pending'
        END AS status
      FROM Users
    ) requestStats
    GROUP BY requestType, status
    ORDER BY requestType, status;
  `;

  return runSelect(query);
}

async function getEmployeesCount() {
  const query = `
    SELECT COUNT(*) AS employeesCount
    FROM Users u
    INNER JOIN Roles r ON r.Id = u.RoleId
    WHERE u.IsActive = 1 AND r.Name = 'Employee';
  `;

  const rows = await runSelect(query);
  return rows[0]?.employeesCount ?? 0;
}

async function getApprovedRequests() {
  const query = `
    SELECT TOP (100)
      'LeaveRequest' AS requestType,
      lr.Id AS requestId,
      u.FullName AS requesterName,
      u.Email AS requesterEmail,
      d.Name AS departmentName,
      CAST(lr.Type AS nvarchar(50)) AS category,
      lr.Reason AS title,
      lr.CreatedAt AS createdAt,
      lr.ReviewedAt AS reviewedAt,
      'Approved' AS status
    FROM LeaveRequests lr
    INNER JOIN Users u ON u.Id = lr.UserId
    INNER JOIN Departments d ON d.Id = u.DepartmentId
    WHERE lr.Status = ${REQUEST_STATUS.approved}

    UNION ALL

    SELECT TOP (100)
      'GeneralRequest' AS requestType,
      gr.Id AS requestId,
      u.FullName AS requesterName,
      u.Email AS requesterEmail,
      d.Name AS departmentName,
      CAST(gr.Category AS nvarchar(50)) AS category,
      gr.Title AS title,
      gr.CreatedAt AS createdAt,
      gr.ResolvedAt AS reviewedAt,
      'Approved' AS status
    FROM GeneralRequests gr
    INNER JOIN Users u ON u.Id = gr.UserId
    INNER JOIN Departments d ON d.Id = u.DepartmentId
    WHERE gr.Status = ${REQUEST_STATUS.approved}

    UNION ALL

    SELECT TOP (100)
      'UserRegistration' AS requestType,
      u.Id AS requestId,
      u.FullName AS requesterName,
      u.Email AS requesterEmail,
      d.Name AS departmentName,
      r.Name AS category,
      'Account approval' AS title,
      u.CreatedAt AS createdAt,
      u.ApprovedAt AS reviewedAt,
      'Approved' AS status
    FROM Users u
    INNER JOIN Departments d ON d.Id = u.DepartmentId
    INNER JOIN Roles r ON r.Id = u.RoleId
    WHERE u.IsActive = 1

    ORDER BY reviewedAt DESC, createdAt DESC;
  `;

  return runSelect(query);
}

async function getRejectedRequests() {
  const query = `
    SELECT TOP (100)
      'LeaveRequest' AS requestType,
      lr.Id AS requestId,
      u.FullName AS requesterName,
      u.Email AS requesterEmail,
      d.Name AS departmentName,
      CAST(lr.Type AS nvarchar(50)) AS category,
      lr.Reason AS title,
      lr.CreatedAt AS createdAt,
      lr.ReviewedAt AS reviewedAt,
      'Rejected' AS status
    FROM LeaveRequests lr
    INNER JOIN Users u ON u.Id = lr.UserId
    INNER JOIN Departments d ON d.Id = u.DepartmentId
    WHERE lr.Status = ${REQUEST_STATUS.rejected}

    UNION ALL

    SELECT TOP (100)
      'GeneralRequest' AS requestType,
      gr.Id AS requestId,
      u.FullName AS requesterName,
      u.Email AS requesterEmail,
      d.Name AS departmentName,
      CAST(gr.Category AS nvarchar(50)) AS category,
      gr.Title AS title,
      gr.CreatedAt AS createdAt,
      gr.ResolvedAt AS reviewedAt,
      'Rejected' AS status
    FROM GeneralRequests gr
    INNER JOIN Users u ON u.Id = gr.UserId
    INNER JOIN Departments d ON d.Id = u.DepartmentId
    WHERE gr.Status = ${REQUEST_STATUS.rejected}

    UNION ALL

    SELECT TOP (100)
      'UserRegistration' AS requestType,
      u.Id AS requestId,
      u.FullName AS requesterName,
      u.Email AS requesterEmail,
      d.Name AS departmentName,
      r.Name AS category,
      'Account approval' AS title,
      u.CreatedAt AS createdAt,
      u.RejectedAt AS reviewedAt,
      'Rejected' AS status
    FROM Users u
    INNER JOIN Departments d ON d.Id = u.DepartmentId
    INNER JOIN Roles r ON r.Id = u.RoleId
    WHERE u.RejectedAt IS NOT NULL

    ORDER BY reviewedAt DESC, createdAt DESC;
  `;

  return runSelect(query);
}

module.exports = {
  getRequestStats,
  getEmployeesCount,
  getDatabaseSchema,
  runSafeSelectQuery,
};
