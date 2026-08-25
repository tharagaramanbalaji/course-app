"""Create the initial schema.

Every table, constraint and index for V1. Reproducible from an empty
PostgreSQL database.


Revision ID: 74af19bc71c5
Revises: 
Create Date: 2026-08-26 00:45:28.504496

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '74af19bc71c5'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('users',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('first_name', sa.String(length=100), nullable=False),
    sa.Column('last_name', sa.String(length=100), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('role', sa.Enum('ADMIN', 'INSTRUCTOR', 'USER', name='user_role'), server_default='USER', nullable=False),
    sa.Column('status', sa.Enum('ACTIVE', 'INACTIVE', name='user_status'), server_default='ACTIVE', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_users')),
    sa.UniqueConstraint('email', name=op.f('uq_users_email'))
    )
    op.create_index('ix_users_role', 'users', ['role'], unique=False)
    op.create_index('ix_users_status', 'users', ['status'], unique=False)
    op.create_table('courses',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('category', sa.String(length=100), nullable=True),
    sa.Column('thumbnail_url', sa.String(length=1000), nullable=True),
    sa.Column('status', sa.Enum('DRAFT', 'PUBLISHED', 'ARCHIVED', name='course_status'), server_default='DRAFT', nullable=False),
    sa.Column('created_by', sa.Uuid(), nullable=False),
    sa.Column('allow_self_enrollment', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name='fk_courses_created_by_users', ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_courses'))
    )
    op.create_index('ix_courses_category', 'courses', ['category'], unique=False)
    op.create_index('ix_courses_created_at', 'courses', ['created_at'], unique=False)
    op.create_index('ix_courses_created_by', 'courses', ['created_by'], unique=False)
    op.create_index('ix_courses_status', 'courses', ['status'], unique=False)
    op.create_table('assignments',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('course_id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('assigned_by', sa.Uuid(), nullable=False),
    sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
    sa.Column('status', sa.Enum('ASSIGNED', 'STARTED', 'COMPLETED', 'CANCELLED', name='assignment_status'), server_default='ASSIGNED', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['assigned_by'], ['users.id'], name='fk_assignments_assigned_by_users', ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['course_id'], ['courses.id'], name='fk_assignments_course_id_courses', ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_assignments_user_id_users', ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_assignments'))
    )
    op.create_index('ix_assignments_assigned_by', 'assignments', ['assigned_by'], unique=False)
    op.create_index('ix_assignments_course_id', 'assignments', ['course_id'], unique=False)
    op.create_index('ix_assignments_course_id_user_id', 'assignments', ['course_id', 'user_id'], unique=False)
    op.create_index('ix_assignments_status', 'assignments', ['status'], unique=False)
    op.create_index('ix_assignments_user_id', 'assignments', ['user_id'], unique=False)
    op.create_table('enrollments',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('course_id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('source', sa.Enum('ASSIGNMENT', 'SELF_ENROLLED', name='enrollment_source'), nullable=False),
    sa.Column('status', sa.Enum('ACTIVE', 'COMPLETED', 'CANCELLED', name='enrollment_status'), server_default='ACTIVE', nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['course_id'], ['courses.id'], name='fk_enrollments_course_id_courses', ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_enrollments_user_id_users', ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_enrollments')),
    sa.UniqueConstraint('course_id', 'user_id', name='uq_enrollments_course_id_user_id')
    )
    op.create_index('ix_enrollments_course_id', 'enrollments', ['course_id'], unique=False)
    op.create_index('ix_enrollments_status', 'enrollments', ['status'], unique=False)
    op.create_index('ix_enrollments_user_id', 'enrollments', ['user_id'], unique=False)
    op.create_table('modules',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('course_id', sa.Uuid(), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('display_order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.CheckConstraint('display_order > 0', name=op.f('ck_modules_display_order_positive')),
    sa.ForeignKeyConstraint(['course_id'], ['courses.id'], name='fk_modules_course_id_courses', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_modules')),
    sa.UniqueConstraint('course_id', 'display_order', name='uq_modules_course_id_display_order')
    )
    op.create_index('ix_modules_course_id', 'modules', ['course_id'], unique=False)
    op.create_table('certificates',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('certificate_number', sa.String(length=100), nullable=False),
    sa.Column('enrollment_id', sa.Uuid(), nullable=False),
    sa.Column('participant_name', sa.String(length=255), nullable=False),
    sa.Column('course_name', sa.String(length=255), nullable=False),
    sa.Column('completion_date', sa.DateTime(timezone=True), nullable=False),
    sa.Column('final_score', sa.Numeric(precision=5, scale=2), nullable=False),
    sa.Column('certificate_url', sa.String(length=1000), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.CheckConstraint('final_score >= 0 AND final_score <= 100', name=op.f('ck_certificates_final_score_percentage')),
    sa.ForeignKeyConstraint(['enrollment_id'], ['enrollments.id'], name='fk_certificates_enrollment_id_enrollments', ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_certificates')),
    sa.UniqueConstraint('certificate_number', name=op.f('uq_certificates_certificate_number')),
    sa.UniqueConstraint('enrollment_id', name=op.f('uq_certificates_enrollment_id'))
    )
    op.create_table('contents',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('module_id', sa.Uuid(), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('content_type', sa.Enum('TEXT', 'VIDEO', name='content_type'), nullable=False),
    sa.Column('content_body', sa.Text(), nullable=True),
    sa.Column('video_url', sa.String(length=1000), nullable=True),
    sa.Column('display_order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.CheckConstraint("(content_type = 'TEXT' AND content_body IS NOT NULL) OR (content_type = 'VIDEO' AND video_url IS NOT NULL)", name=op.f('ck_contents_payload_matches_type')),
    sa.CheckConstraint('display_order > 0', name=op.f('ck_contents_display_order_positive')),
    sa.ForeignKeyConstraint(['module_id'], ['modules.id'], name='fk_contents_module_id_modules', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_contents')),
    sa.UniqueConstraint('module_id', 'display_order', name='uq_contents_module_id_display_order')
    )
    op.create_index('ix_contents_module_id', 'contents', ['module_id'], unique=False)
    op.create_table('module_progress',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('enrollment_id', sa.Uuid(), nullable=False),
    sa.Column('module_id', sa.Uuid(), nullable=False),
    sa.Column('content_completed', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('quiz_passed', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('status', sa.Enum('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', name='progress_status'), server_default='NOT_STARTED', nullable=False),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['enrollment_id'], ['enrollments.id'], name='fk_module_progress_enrollment_id_enrollments', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['module_id'], ['modules.id'], name='fk_module_progress_module_id_modules', ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_module_progress')),
    sa.UniqueConstraint('enrollment_id', 'module_id', name='uq_module_progress_enrollment_id_module_id')
    )
    op.create_index('ix_module_progress_enrollment_id', 'module_progress', ['enrollment_id'], unique=False)
    op.create_index('ix_module_progress_module_id', 'module_progress', ['module_id'], unique=False)
    op.create_index('ix_module_progress_status', 'module_progress', ['status'], unique=False)
    op.create_table('quizzes',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('module_id', sa.Uuid(), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('passing_score', sa.Numeric(precision=5, scale=2), nullable=False),
    sa.Column('max_attempts', sa.Integer(), nullable=True),
    sa.Column('randomize_questions', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.CheckConstraint('max_attempts IS NULL OR max_attempts >= 1', name=op.f('ck_quizzes_max_attempts_positive')),
    sa.CheckConstraint('passing_score >= 0 AND passing_score <= 100', name=op.f('ck_quizzes_passing_score_percentage')),
    sa.ForeignKeyConstraint(['module_id'], ['modules.id'], name='fk_quizzes_module_id_modules', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_quizzes')),
    sa.UniqueConstraint('module_id', name=op.f('uq_quizzes_module_id'))
    )
    op.create_table('content_progress',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('enrollment_id', sa.Uuid(), nullable=False),
    sa.Column('content_id', sa.Uuid(), nullable=False),
    sa.Column('completed', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['content_id'], ['contents.id'], name='fk_content_progress_content_id_contents', ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['enrollment_id'], ['enrollments.id'], name='fk_content_progress_enrollment_id_enrollments', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_content_progress')),
    sa.UniqueConstraint('enrollment_id', 'content_id', name='uq_content_progress_enrollment_id_content_id')
    )
    op.create_index('ix_content_progress_content_id', 'content_progress', ['content_id'], unique=False)
    op.create_index('ix_content_progress_enrollment_id', 'content_progress', ['enrollment_id'], unique=False)
    op.create_table('questions',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('quiz_id', sa.Uuid(), nullable=False),
    sa.Column('question_text', sa.Text(), nullable=False),
    sa.Column('points', sa.Numeric(precision=8, scale=2), nullable=False),
    sa.Column('display_order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.CheckConstraint('display_order > 0', name=op.f('ck_questions_display_order_positive')),
    sa.CheckConstraint('points > 0', name=op.f('ck_questions_points_positive')),
    sa.ForeignKeyConstraint(['quiz_id'], ['quizzes.id'], name='fk_questions_quiz_id_quizzes', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_questions')),
    sa.UniqueConstraint('quiz_id', 'display_order', name='uq_questions_quiz_id_display_order')
    )
    op.create_index('ix_questions_quiz_id', 'questions', ['quiz_id'], unique=False)
    op.create_table('quiz_attempts',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('quiz_id', sa.Uuid(), nullable=False),
    sa.Column('enrollment_id', sa.Uuid(), nullable=False),
    sa.Column('attempt_number', sa.Integer(), nullable=False),
    sa.Column('score', sa.Numeric(precision=5, scale=2), nullable=True),
    sa.Column('passed', sa.Boolean(), nullable=True),
    sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.CheckConstraint('attempt_number >= 1', name=op.f('ck_quiz_attempts_attempt_number_positive')),
    sa.CheckConstraint('score IS NULL OR (score >= 0 AND score <= 100)', name=op.f('ck_quiz_attempts_score_percentage')),
    sa.ForeignKeyConstraint(['enrollment_id'], ['enrollments.id'], name='fk_quiz_attempts_enrollment_id_enrollments', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['quiz_id'], ['quizzes.id'], name='fk_quiz_attempts_quiz_id_quizzes', ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_quiz_attempts')),
    sa.UniqueConstraint('enrollment_id', 'quiz_id', 'attempt_number', name='uq_quiz_attempts_enrollment_id_quiz_id_attempt_number')
    )
    op.create_index('ix_quiz_attempts_enrollment_id', 'quiz_attempts', ['enrollment_id'], unique=False)
    op.create_index('ix_quiz_attempts_enrollment_id_quiz_id', 'quiz_attempts', ['enrollment_id', 'quiz_id'], unique=False)
    op.create_index('ix_quiz_attempts_quiz_id', 'quiz_attempts', ['quiz_id'], unique=False)
    op.create_table('answers',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('question_id', sa.Uuid(), nullable=False),
    sa.Column('answer_text', sa.Text(), nullable=False),
    sa.Column('is_correct', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('display_order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.CheckConstraint('display_order > 0', name=op.f('ck_answers_display_order_positive')),
    sa.ForeignKeyConstraint(['question_id'], ['questions.id'], name='fk_answers_question_id_questions', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_answers')),
    sa.UniqueConstraint('question_id', 'display_order', name='uq_answers_question_id_display_order')
    )
    op.create_index('ix_answers_question_id', 'answers', ['question_id'], unique=False)
    op.create_table('quiz_attempt_answers',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('attempt_id', sa.Uuid(), nullable=False),
    sa.Column('question_id', sa.Uuid(), nullable=False),
    sa.Column('answer_id', sa.Uuid(), nullable=False),
    sa.Column('is_correct', sa.Boolean(), nullable=False),
    sa.Column('points_earned', sa.Numeric(precision=8, scale=2), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.CheckConstraint('points_earned >= 0', name=op.f('ck_quiz_attempt_answers_points_earned_non_negative')),
    sa.ForeignKeyConstraint(['answer_id'], ['answers.id'], name='fk_quiz_attempt_answers_answer_id_answers', ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['attempt_id'], ['quiz_attempts.id'], name='fk_quiz_attempt_answers_attempt_id_quiz_attempts', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['question_id'], ['questions.id'], name='fk_quiz_attempt_answers_question_id_questions', ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_quiz_attempt_answers')),
    sa.UniqueConstraint('attempt_id', 'question_id', name='uq_quiz_attempt_answers_attempt_id_question_id')
    )
    op.create_index('ix_quiz_attempt_answers_answer_id', 'quiz_attempt_answers', ['answer_id'], unique=False)
    op.create_index('ix_quiz_attempt_answers_attempt_id', 'quiz_attempt_answers', ['attempt_id'], unique=False)
    op.create_index('ix_quiz_attempt_answers_question_id', 'quiz_attempt_answers', ['question_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_quiz_attempt_answers_question_id', table_name='quiz_attempt_answers')
    op.drop_index('ix_quiz_attempt_answers_attempt_id', table_name='quiz_attempt_answers')
    op.drop_index('ix_quiz_attempt_answers_answer_id', table_name='quiz_attempt_answers')
    op.drop_table('quiz_attempt_answers')
    op.drop_index('ix_answers_question_id', table_name='answers')
    op.drop_table('answers')
    op.drop_index('ix_quiz_attempts_quiz_id', table_name='quiz_attempts')
    op.drop_index('ix_quiz_attempts_enrollment_id_quiz_id', table_name='quiz_attempts')
    op.drop_index('ix_quiz_attempts_enrollment_id', table_name='quiz_attempts')
    op.drop_table('quiz_attempts')
    op.drop_index('ix_questions_quiz_id', table_name='questions')
    op.drop_table('questions')
    op.drop_index('ix_content_progress_enrollment_id', table_name='content_progress')
    op.drop_index('ix_content_progress_content_id', table_name='content_progress')
    op.drop_table('content_progress')
    op.drop_table('quizzes')
    op.drop_index('ix_module_progress_status', table_name='module_progress')
    op.drop_index('ix_module_progress_module_id', table_name='module_progress')
    op.drop_index('ix_module_progress_enrollment_id', table_name='module_progress')
    op.drop_table('module_progress')
    op.drop_index('ix_contents_module_id', table_name='contents')
    op.drop_table('contents')
    op.drop_table('certificates')
    op.drop_index('ix_modules_course_id', table_name='modules')
    op.drop_table('modules')
    op.drop_index('ix_enrollments_user_id', table_name='enrollments')
    op.drop_index('ix_enrollments_status', table_name='enrollments')
    op.drop_index('ix_enrollments_course_id', table_name='enrollments')
    op.drop_table('enrollments')
    op.drop_index('ix_assignments_user_id', table_name='assignments')
    op.drop_index('ix_assignments_status', table_name='assignments')
    op.drop_index('ix_assignments_course_id_user_id', table_name='assignments')
    op.drop_index('ix_assignments_course_id', table_name='assignments')
    op.drop_index('ix_assignments_assigned_by', table_name='assignments')
    op.drop_table('assignments')
    op.drop_index('ix_courses_status', table_name='courses')
    op.drop_index('ix_courses_created_by', table_name='courses')
    op.drop_index('ix_courses_created_at', table_name='courses')
    op.drop_index('ix_courses_category', table_name='courses')
    op.drop_table('courses')
    op.drop_index('ix_users_status', table_name='users')
    op.drop_index('ix_users_role', table_name='users')
    op.drop_table('users')

    # Dropping a table does not drop the enum types it used.
    sa.Enum(name='user_role').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='user_status').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='course_status').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='content_type').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='assignment_status').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='enrollment_source').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='enrollment_status').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='progress_status').drop(op.get_bind(), checkfirst=True)
