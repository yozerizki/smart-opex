BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[users] (
    [id] INT NOT NULL IDENTITY(1,1),
    [email] VARCHAR(100) NOT NULL,
    [password_hash] NVARCHAR(1000) NOT NULL,
    [role] VARCHAR(20) NOT NULL,
    [district_id] INT,
    [area_id] INT,
    [is_active] BIT CONSTRAINT [users_is_active_df] DEFAULT 1,
    [created_at] DATETIME2 CONSTRAINT [users_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [users_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[user_profiles] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_id] INT NOT NULL,
    [full_name] VARCHAR(150) NOT NULL,
    [position] VARCHAR(100) NOT NULL,
    [nip] VARCHAR(50),
    [phone_number] VARCHAR(30) NOT NULL,
    [nik_ktp] VARCHAR(20) NOT NULL,
    [ktp_scan_path] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 CONSTRAINT [user_profiles_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 CONSTRAINT [user_profiles_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [user_profiles_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [user_profiles_user_id_key] UNIQUE NONCLUSTERED ([user_id])
);

-- CreateTable
CREATE TABLE [dbo].[opex_projects] (
    [id] INT NOT NULL IDENTITY(1,1),
    [project_name] VARCHAR(150) NOT NULL,
    [description] NVARCHAR(1000),
    [start_date] DATE,
    [end_date] DATE,
    [status] VARCHAR(20) CONSTRAINT [opex_projects_status_df] DEFAULT 'DRAFT',
    [created_by] INT,
    [created_at] DATETIME2 CONSTRAINT [opex_projects_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [opex_projects_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[opex_items] (
    [id] INT NOT NULL IDENTITY(1,1),
    [project_id] INT,
    [district_id] INT NOT NULL,
    [group_view_id] INT,
    [item_name] VARCHAR(150) NOT NULL,
    [category] VARCHAR(100),
    [recipient_name] VARCHAR(150),
    [amount] DECIMAL(15,2),
    [transaction_date] DATE,
    [status] VARCHAR(20) CONSTRAINT [opex_items_status_df] DEFAULT 'DRAFT',
    [created_by] INT,
    [created_at] DATETIME2 CONSTRAINT [opex_items_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [opex_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[opex_receipts] (
    [id] INT NOT NULL IDENTITY(1,1),
    [opex_item_id] INT NOT NULL,
    [file_path] NVARCHAR(1000) NOT NULL,
    [ocr_detected_total] DECIMAL(15,2),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [opex_receipts_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [opex_receipts_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[districts] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] VARCHAR(150) NOT NULL,
    [area_id] INT NOT NULL,
    [created_at] DATETIME2 CONSTRAINT [districts_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [districts_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [districts_area_id_name_key] UNIQUE NONCLUSTERED ([area_id],[name])
);

-- CreateTable
CREATE TABLE [dbo].[regions] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] VARCHAR(150) NOT NULL,
    [created_at] DATETIME2 CONSTRAINT [regions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [regions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [regions_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[areas] (
    [id] INT NOT NULL IDENTITY(1,1),
    [region_id] INT NOT NULL,
    [name] VARCHAR(150) NOT NULL,
    [created_at] DATETIME2 CONSTRAINT [areas_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [areas_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [areas_region_id_name_key] UNIQUE NONCLUSTERED ([region_id],[name])
);

-- CreateTable
CREATE TABLE [dbo].[group_views] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] VARCHAR(150) NOT NULL,
    [created_at] DATETIME2 CONSTRAINT [group_views_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [group_views_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [group_views_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[documents] (
    [id] INT NOT NULL IDENTITY(1,1),
    [opex_item_id] INT,
    [file_path] NVARCHAR(1000) NOT NULL,
    [file_type] VARCHAR(50),
    [uploaded_at] DATETIME2 CONSTRAINT [documents_uploaded_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [documents_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ocr_results] (
    [id] INT NOT NULL IDENTITY(1,1),
    [document_id] INT,
    [extracted_text] NVARCHAR(1000),
    [parsed_amount] DECIMAL(15,2),
    [parsed_date] DATE,
    [confidence_score] DECIMAL(5,2),
    [created_at] DATETIME2 CONSTRAINT [ocr_results_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ocr_results_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[audit_logs] (
    [id] INT NOT NULL IDENTITY(1,1),
    [user_id] INT,
    [action] VARCHAR(100),
    [entity] VARCHAR(50),
    [entity_id] INT,
    [created_at] DATETIME2 CONSTRAINT [audit_logs_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [audit_logs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[users] ADD CONSTRAINT [users_district_id_fkey] FOREIGN KEY ([district_id]) REFERENCES [dbo].[districts]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[users] ADD CONSTRAINT [users_area_id_fkey] FOREIGN KEY ([area_id]) REFERENCES [dbo].[areas]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[user_profiles] ADD CONSTRAINT [user_profiles_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[opex_projects] ADD CONSTRAINT [opex_projects_created_by_fkey] FOREIGN KEY ([created_by]) REFERENCES [dbo].[users]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[opex_items] ADD CONSTRAINT [opex_items_created_by_fkey] FOREIGN KEY ([created_by]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[opex_items] ADD CONSTRAINT [opex_items_project_id_fkey] FOREIGN KEY ([project_id]) REFERENCES [dbo].[opex_projects]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[opex_items] ADD CONSTRAINT [opex_items_district_id_fkey] FOREIGN KEY ([district_id]) REFERENCES [dbo].[districts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[opex_items] ADD CONSTRAINT [opex_items_group_view_id_fkey] FOREIGN KEY ([group_view_id]) REFERENCES [dbo].[group_views]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[opex_receipts] ADD CONSTRAINT [opex_receipts_opex_item_id_fkey] FOREIGN KEY ([opex_item_id]) REFERENCES [dbo].[opex_items]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[districts] ADD CONSTRAINT [districts_area_id_fkey] FOREIGN KEY ([area_id]) REFERENCES [dbo].[areas]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[areas] ADD CONSTRAINT [areas_region_id_fkey] FOREIGN KEY ([region_id]) REFERENCES [dbo].[regions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[documents] ADD CONSTRAINT [documents_opex_item_id_fkey] FOREIGN KEY ([opex_item_id]) REFERENCES [dbo].[opex_items]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ocr_results] ADD CONSTRAINT [ocr_results_document_id_fkey] FOREIGN KEY ([document_id]) REFERENCES [dbo].[documents]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[audit_logs] ADD CONSTRAINT [audit_logs_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

